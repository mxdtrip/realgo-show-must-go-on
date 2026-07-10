package ai

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"
)

// defaultLockTTL bounds how long a generation may hold its lock. It also
// caps ProvisionAsync's background context, so a stuck provider call cannot
// leak goroutines indefinitely.
const defaultLockTTL = 90 * time.Second

// ProblemInfo is the problem context fed into the generation prompt.
type ProblemInfo struct {
	Title      string
	URL        string
	Difficulty string
	Platform   string
	Slug       string
}

// ProvisionRepository is the storage behaviour CardProvisioner needs.
type ProvisionRepository interface {
	CountGlobalCards(ctx context.Context, problemID int64) (int64, error)
	ProblemInfo(ctx context.Context, problemID int64) (ProblemInfo, error)
	// UpsertGeneratedCards stores the whole generated batch atomically: a
	// reader must never observe a partial batch as "ready". platform/slug
	// build each card's deterministic "ai:{platform}:{slug}:{type}" source key.
	UpsertGeneratedCards(ctx context.Context, problemID int64, platform, slug string, cards []GeneratedCard, promptVersion string) error
	LogGenerationRequest(ctx context.Context, model, status string) error
}

// locker is the narrow Redis behaviour CardProvisioner needs to dedupe
// concurrent generations for the same problem. Satisfied structurally by
// *redis.Storage.
type locker interface {
	TryLock(ctx context.Context, key string, ttl time.Duration) (bool, error)
	Unlock(ctx context.Context, key string) error
}

// Provisioner (CardProvisioner) generates and persists global AI cards for a
// solved problem, at most once per problem: a Redis lock
// (lock:gen:{platform}:{slug}) dedupes concurrent attempts, and the
// cards_source_global_unique_idx unique index makes the batch insert itself
// idempotent even if two lock holders ever raced.
type Provisioner struct {
	repo     ProvisionRepository
	lock     locker
	provider Provider
	logger   *slog.Logger
	lockTTL  time.Duration
}

// NewProvisioner wires a CardProvisioner. provider is typically a
// *GeminiProvider in production or an *aitest.Fake in tests.
func NewProvisioner(repo ProvisionRepository, lock locker, provider Provider, logger *slog.Logger) *Provisioner {
	return &Provisioner{repo: repo, lock: lock, provider: provider, logger: logger, lockTTL: defaultLockTTL}
}

// LockKey builds the lock:gen:{platform}:{slug} key shared between
// CardProvisioner (writer) and the status endpoint (read-only checker).
func LockKey(platform, slug string) string {
	return fmt.Sprintf("lock:gen:%s:%s", platform, slug)
}

// ProvisionAsync runs Provision in the background with a bounded timeout,
// logging (not returning) any failure. Safe to call on every solved event:
// Provision is idempotent and cheap when cards already exist.
func (p *Provisioner) ProvisionAsync(problemID int64, platform, slug string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), defaultLockTTL)
		defer cancel()
		if err := p.Provision(ctx, problemID, platform, slug); err != nil {
			p.logger.Warn("ai: card generation failed",
				slog.Int64("problemId", problemID), slog.String("platform", platform), slog.String("slug", slug), slog.Any("err", err))
		}
	}()
}

// Provision generates and stores the three global cards for problemID,
// unless they already exist or another attempt is already in flight.
func (p *Provisioner) Provision(ctx context.Context, problemID int64, platform, slug string) error {
	if already, err := p.hasCards(ctx, problemID); err != nil || already {
		return err
	}

	key := LockKey(platform, slug)
	acquired, err := p.lock.TryLock(ctx, key, p.lockTTL)
	if err != nil {
		return fmt.Errorf("ai: acquire lock: %w", err)
	}
	if !acquired {
		return nil // another attempt is already generating this problem
	}
	defer func() { _ = p.lock.Unlock(context.WithoutCancel(ctx), key) }()

	// Re-check after acquiring the lock: a concurrent attempt may have
	// finished generation between our first check and the lock acquisition.
	if already, err := p.hasCards(ctx, problemID); err != nil || already {
		return err
	}

	info, err := p.repo.ProblemInfo(ctx, problemID)
	if err != nil {
		return fmt.Errorf("ai: load problem info: %w", err)
	}

	cards, err := p.provider.GenerateCards(ctx, GenerateCardsInput{
		Platform:   info.Platform,
		Slug:       info.Slug,
		Title:      info.Title,
		Difficulty: info.Difficulty,
		URL:        info.URL,
	})
	if err != nil {
		return p.logAndClassify(ctx, err)
	}

	if err := p.repo.UpsertGeneratedCards(ctx, problemID, info.Platform, info.Slug, cards, p.provider.PromptVersion()); err != nil {
		return fmt.Errorf("ai: store generated cards: %w", err)
	}

	if err := p.repo.LogGenerationRequest(ctx, p.provider.PromptVersion(), "success"); err != nil {
		p.logger.Warn("ai: failed to log generation request", slog.Any("err", err))
	}
	return nil
}

func (p *Provisioner) hasCards(ctx context.Context, problemID int64) (bool, error) {
	count, err := p.repo.CountGlobalCards(ctx, problemID)
	if err != nil {
		return false, fmt.Errorf("ai: count global cards: %w", err)
	}
	return count > 0, nil
}

// logAndClassify records the generation outcome. A model refusal
// (unknown_problem/quota) is expected, recoverable behaviour — it surfaces
// downstream as status "none", not a hard error — everything else propagates.
func (p *Provisioner) logAndClassify(ctx context.Context, err error) error {
	status := "failed"
	if errors.Is(err, ErrUnknownProblem) || errors.Is(err, ErrQuotaExceeded) {
		status = "refused"
	}
	if logErr := p.repo.LogGenerationRequest(ctx, p.provider.PromptVersion(), status); logErr != nil {
		p.logger.Warn("ai: failed to log generation request", slog.Any("err", logErr))
	}
	if status == "refused" {
		return nil
	}
	p.logProviderError(err)
	return fmt.Errorf("ai: generate cards: %w", err)
}

// logProviderError surfaces the upstream HTTP status code and response body
// as separate fields when the failure is a *APIError, so a Google-side
// rejection (geo block, permission/quota denial) is distinguishable in logs
// from a transient network error without needing shell access to prod.
func (p *Provisioner) logProviderError(err error) {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		p.logger.Warn("ai: card generation: gemini api error",
			slog.Int("status_code", apiErr.StatusCode),
			slog.String("body", apiErr.Body),
		)
	}
}
