package ai

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

// defaultLockTTL bounds how long a generation may hold its lock. It also
// caps ProvisionAsync's background context, so a stuck provider call cannot
// leak goroutines indefinitely.
const defaultLockTTL = 90 * time.Second

// cacheTTL bounds how long a "ready" marker lives in Redis. It doesn't need
// active invalidation on a prompt bump: the key is namespaced by prompt
// version (see CacheKey), so a bump simply starts looking up a different,
// as-yet-unset key rather than requiring the old one to be cleared.
const cacheTTL = 30 * 24 * time.Hour

// readyCacheValue is the marker stored at a CacheKey; its content doesn't
// matter, only presence (a cache hit) does.
const readyCacheValue = "1"

// EnsureReady and EnsureGenerating are the two outcomes Ensure reports to
// callers such as POST /me/cards/generate.
const (
	EnsureReady      = "ready"
	EnsureGenerating = "generating"
)

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
	// HasReadyCards reports whether problemID already has cards ready to
	// serve (seed content, or AI cards at the current prompt version) —
	// false for AI cards left over from an older prompt version.
	HasReadyCards(ctx context.Context, problemID int64, promptVersion string) (bool, error)
	ProblemInfo(ctx context.Context, problemID int64) (ProblemInfo, error)
	// UpsertGeneratedCards stores the whole generated batch atomically: a
	// reader must never observe a partial batch as "ready". platform/slug
	// build each card's deterministic "ai:{platform}:{slug}:{type}" source key.
	UpsertGeneratedCards(ctx context.Context, problemID int64, platform, slug string, cards []GeneratedCard, promptVersion string) error
	LogGenerationRequest(ctx context.Context, model, status string) error
}

// redisClient is the narrow Redis behaviour CardProvisioner needs: SETNX-style
// locking to dedupe concurrent generation, plus a small readiness cache
// (cards:v1:{promptVersion}:{platform}:{slug}) to skip a Postgres round-trip
// once a problem's cards are known good. Satisfied structurally by
// *redis.Storage.
type redisClient interface {
	TryLock(ctx context.Context, key string, ttl time.Duration) (bool, error)
	Unlock(ctx context.Context, key string) error
	Locked(ctx context.Context, key string) (bool, error)
	Save(ctx context.Context, key string, value any, ttl time.Duration) error
	Get(ctx context.Context, key string) ([]byte, error)
}

// Provisioner (CardProvisioner) generates and persists global AI cards for a
// solved problem, at most once per problem: a Redis lock
// (lock:gen:{platform}:{slug}) dedupes concurrent attempts, and the
// cards_source_global_unique_idx unique index makes the batch insert itself
// idempotent even if two lock holders ever raced.
type Provisioner struct {
	repo     ProvisionRepository
	redis    redisClient
	provider Provider
	logger   *slog.Logger
	lockTTL  time.Duration
}

// NewProvisioner wires a CardProvisioner. provider is typically a
// *GeminiProvider in production or an *aitest.Fake in tests.
func NewProvisioner(repo ProvisionRepository, redis redisClient, provider Provider, logger *slog.Logger) *Provisioner {
	return &Provisioner{repo: repo, redis: redis, provider: provider, logger: logger, lockTTL: defaultLockTTL}
}

// LockKey builds the lock:gen:{platform}:{slug} key shared between
// CardProvisioner (writer) and the status endpoint (read-only checker).
func LockKey(platform, slug string) string {
	return fmt.Sprintf("lock:gen:%s:%s", platform, slug)
}

// CacheKey builds the cards:v1:{promptVersion}:{platform}:{slug} readiness
// cache key. A HIT means problemID already has cards ready to serve at this
// exact prompt version, without touching Postgres.
func CacheKey(promptVersion, platform, slug string) string {
	return fmt.Sprintf("cards:v1:%s:%s:%s", promptVersion, platform, slug)
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

// Ensure reports readiness for problemID without blocking on generation: it
// checks the cache/Postgres for cards already ready to serve (current prompt
// version, or seed content), and if none exist, makes sure exactly one
// generation attempt is in flight — starting one if none was already running
// — before returning immediately. Used by POST /me/cards/generate. The
// solved-ingest path (extension.Service.Handle) calls ProvisionAsync
// directly instead, since it already has platform/slug from the event and
// doesn't need a status back.
func (p *Provisioner) Ensure(ctx context.Context, problemID int64) (string, error) {
	info, err := p.repo.ProblemInfo(ctx, problemID)
	if err != nil {
		return "", fmt.Errorf("ai: load problem info: %w", err)
	}

	ready, err := p.checkReady(ctx, problemID, info.Platform, info.Slug)
	if err != nil {
		return "", err
	}
	if ready {
		return EnsureReady, nil
	}

	locked, err := p.redis.Locked(ctx, LockKey(info.Platform, info.Slug))
	if err != nil {
		return "", fmt.Errorf("ai: check lock: %w", err)
	}
	if !locked {
		p.ProvisionAsync(problemID, info.Platform, info.Slug)
	}
	return EnsureGenerating, nil
}

// Provision generates and stores the three global cards for problemID,
// unless they already exist at the current prompt version (or as seed
// content) or another attempt is already in flight.
func (p *Provisioner) Provision(ctx context.Context, problemID int64, platform, slug string) error {
	if ready, err := p.checkReady(ctx, problemID, platform, slug); err != nil || ready {
		return err
	}

	key := LockKey(platform, slug)
	acquired, err := p.redis.TryLock(ctx, key, p.lockTTL)
	if err != nil {
		return fmt.Errorf("ai: acquire lock: %w", err)
	}
	if !acquired {
		return nil // another attempt is already generating this problem
	}
	defer func() { _ = p.redis.Unlock(context.WithoutCancel(ctx), key) }()

	// Re-check after acquiring the lock: a concurrent attempt may have
	// finished generation between our first check and the lock acquisition.
	if ready, err := p.checkReady(ctx, problemID, platform, slug); err != nil || ready {
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
	p.warmCache(ctx, CacheKey(p.provider.PromptVersion(), platform, slug))

	if err := p.repo.LogGenerationRequest(ctx, p.provider.PromptVersion(), "success"); err != nil {
		p.logger.Warn("ai: failed to log generation request", slog.Any("err", err))
	}
	return nil
}

// checkReady reports whether problemID has cards ready to serve, checking
// the Redis cache first and falling back to Postgres (HasReadyCards) on a
// miss — warming the cache on a Postgres hit so the next check for this
// problem+prompt-version skips Postgres entirely.
func (p *Provisioner) checkReady(ctx context.Context, problemID int64, platform, slug string) (bool, error) {
	key := CacheKey(p.provider.PromptVersion(), platform, slug)
	if p.cacheHit(ctx, key) {
		return true, nil
	}

	ready, err := p.repo.HasReadyCards(ctx, problemID, p.provider.PromptVersion())
	if err != nil {
		return false, fmt.Errorf("ai: check ready cards: %w", err)
	}
	if ready {
		p.warmCache(ctx, key)
	}
	return ready, nil
}

// cacheHit reports whether key is present in Redis. A Redis error other than
// a plain cache miss is logged and treated as a miss: Postgres is the
// authoritative source, so a degraded cache never blocks generation checks.
func (p *Provisioner) cacheHit(ctx context.Context, key string) bool {
	if _, err := p.redis.Get(ctx, key); err != nil {
		if !errors.Is(err, goredis.Nil) {
			p.logger.Warn("ai: cache read failed", slog.String("key", key), slog.Any("err", err))
		}
		return false
	}
	return true
}

func (p *Provisioner) warmCache(ctx context.Context, key string) {
	if err := p.redis.Save(ctx, key, readyCacheValue, cacheTTL); err != nil {
		p.logger.Warn("ai: cache warm failed", slog.String("key", key), slog.Any("err", err))
	}
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
