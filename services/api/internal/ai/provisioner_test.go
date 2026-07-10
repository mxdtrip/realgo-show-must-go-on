package ai_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/mxdtrip/freeburger/services/api/internal/ai"
	"github.com/mxdtrip/freeburger/services/api/internal/ai/aitest"
)

// fakeProvisionRepo tracks just enough state to fake HasReadyCards
// realistically: readyVersion is the ai_prompt_version of whatever cards
// UpsertGeneratedCards last stored ("" means no AI cards yet), and seedReady
// simulates pre-existing seed content, which counts as ready regardless of
// prompt version (seed cards are curated, never stale).
type fakeProvisionRepo struct {
	mu           sync.Mutex
	readyVersion string
	seedReady    bool
	info         ai.ProblemInfo
	infoErr      error
	upserted     []ai.GeneratedCard
	upsertErr    error
	logs         []string
}

func (f *fakeProvisionRepo) HasReadyCards(_ context.Context, _ int64, promptVersion string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.seedReady {
		return true, nil
	}
	return f.readyVersion != "" && f.readyVersion == promptVersion, nil
}

func (f *fakeProvisionRepo) ProblemInfo(context.Context, int64) (ai.ProblemInfo, error) {
	if f.infoErr != nil {
		return ai.ProblemInfo{}, f.infoErr
	}
	return f.info, nil
}

func (f *fakeProvisionRepo) UpsertGeneratedCards(_ context.Context, _ int64, _, _ string, cards []ai.GeneratedCard, promptVersion string) error {
	if f.upsertErr != nil {
		return f.upsertErr
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.upserted = append(f.upserted, cards...)
	f.readyVersion = promptVersion
	return nil
}

func (f *fakeProvisionRepo) LogGenerationRequest(_ context.Context, _, status string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.logs = append(f.logs, status)
	return nil
}

func (f *fakeProvisionRepo) upsertedCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.upserted)
}

// fakeRedis mimics the narrow Redis behaviour Provisioner needs — SETNX-style
// locking plus a small readiness cache — in-process. It satisfies ai's
// unexported redisClient interface structurally.
type fakeRedis struct {
	mu     sync.Mutex
	locked map[string]bool
	cache  map[string][]byte
}

func newFakeRedis() *fakeRedis {
	return &fakeRedis{locked: map[string]bool{}, cache: map[string][]byte{}}
}

func (r *fakeRedis) TryLock(_ context.Context, key string, _ time.Duration) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.locked[key] {
		return false, nil
	}
	r.locked[key] = true
	return true, nil
}

func (r *fakeRedis) Unlock(_ context.Context, key string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.locked, key)
	return nil
}

func (r *fakeRedis) Locked(_ context.Context, key string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.locked[key], nil
}

func (r *fakeRedis) Save(_ context.Context, key string, value any, _ time.Duration) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cache[key] = []byte(fmt.Sprint(value))
	return nil
}

func (r *fakeRedis) Get(_ context.Context, key string) ([]byte, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	v, ok := r.cache[key]
	if !ok {
		return nil, goredis.Nil
	}
	return v, nil
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestProvisioner_Provision_GeneratesAndStoresCards(t *testing.T) {
	repo := &fakeProvisionRepo{info: ai.ProblemInfo{Title: "Two Sum", Platform: "leetcode", Slug: "two-sum"}}
	provider := aitest.New()
	p := ai.NewProvisioner(repo, newFakeRedis(), provider, testLogger())

	if err := p.Provision(context.Background(), 1, "leetcode", "two-sum"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if provider.Calls() != 1 {
		t.Fatalf("provider calls = %d, want 1", provider.Calls())
	}
	if len(repo.upserted) != 3 {
		t.Fatalf("upserted %d cards, want 3", len(repo.upserted))
	}
	if len(repo.logs) != 1 || repo.logs[0] != "success" {
		t.Fatalf("logs = %v, want [success]", repo.logs)
	}
}

func TestProvisioner_Provision_SkipsWhenCardsAlreadyExist(t *testing.T) {
	repo := &fakeProvisionRepo{readyVersion: "fake-v1"}
	provider := aitest.New()
	p := ai.NewProvisioner(repo, newFakeRedis(), provider, testLogger())

	if err := p.Provision(context.Background(), 1, "leetcode", "two-sum"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if provider.Calls() != 0 {
		t.Fatalf("provider calls = %d, want 0 (idempotent no-op)", provider.Calls())
	}
}

func TestProvisioner_Provision_SkipsWhenSeedCardsExist(t *testing.T) {
	repo := &fakeProvisionRepo{seedReady: true}
	provider := aitest.New()
	p := ai.NewProvisioner(repo, newFakeRedis(), provider, testLogger())

	if err := p.Provision(context.Background(), 1, "leetcode", "two-sum"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if provider.Calls() != 0 {
		t.Fatalf("provider calls = %d, want 0 (seed content never stale)", provider.Calls())
	}
}

// TestProvisioner_Provision_RegeneratesOnStalePromptVersion guards the
// invalidation contract cards.ai_prompt_version exists for: an AI card
// stored under an older prompt version must not be treated as ready, so a
// prompt bump actually triggers regeneration instead of serving stale
// content forever.
func TestProvisioner_Provision_RegeneratesOnStalePromptVersion(t *testing.T) {
	repo := &fakeProvisionRepo{
		info:         ai.ProblemInfo{Title: "Two Sum", Platform: "leetcode", Slug: "two-sum"},
		readyVersion: "old-version",
	}
	provider := aitest.New() // PromptVersion() defaults to "fake-v1" != "old-version"
	p := ai.NewProvisioner(repo, newFakeRedis(), provider, testLogger())

	if err := p.Provision(context.Background(), 1, "leetcode", "two-sum"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if provider.Calls() != 1 {
		t.Fatalf("provider calls = %d, want 1 (stale version must regenerate)", provider.Calls())
	}
	if repo.readyVersion != "fake-v1" {
		t.Fatalf("readyVersion = %q, want updated to the current prompt version", repo.readyVersion)
	}
}

func TestProvisioner_Provision_SkipsWhenLockHeld(t *testing.T) {
	repo := &fakeProvisionRepo{}
	provider := aitest.New()
	redis := newFakeRedis()
	_, _ = redis.TryLock(context.Background(), ai.LockKey("leetcode", "two-sum"), time.Minute)

	p := ai.NewProvisioner(repo, redis, provider, testLogger())
	if err := p.Provision(context.Background(), 1, "leetcode", "two-sum"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if provider.Calls() != 0 {
		t.Fatalf("provider calls = %d, want 0 (lock held elsewhere)", provider.Calls())
	}
}

func TestProvisioner_Provision_UnknownProblemIsNotAnError(t *testing.T) {
	repo := &fakeProvisionRepo{}
	provider := aitest.New()
	provider.Err = ai.ErrUnknownProblem
	p := ai.NewProvisioner(repo, newFakeRedis(), provider, testLogger())

	if err := p.Provision(context.Background(), 1, "leetcode", "mystery"); err != nil {
		t.Fatalf("unknown_problem must not propagate as an error, got: %v", err)
	}
	if len(repo.upserted) != 0 {
		t.Fatalf("expected no cards stored, got %d", len(repo.upserted))
	}
	if len(repo.logs) != 1 || repo.logs[0] != "refused" {
		t.Fatalf("logs = %v, want [refused]", repo.logs)
	}
}

func TestProvisioner_Provision_QuotaExceededIsNotAnError(t *testing.T) {
	repo := &fakeProvisionRepo{}
	provider := aitest.New()
	provider.Err = ai.ErrQuotaExceeded
	p := ai.NewProvisioner(repo, newFakeRedis(), provider, testLogger())

	if err := p.Provision(context.Background(), 1, "leetcode", "two-sum"); err != nil {
		t.Fatalf("quota_exceeded must not propagate as an error, got: %v", err)
	}
	if repo.logs[0] != "refused" {
		t.Fatalf("logs = %v, want [refused]", repo.logs)
	}
}

func TestProvisioner_Provision_OtherErrorsPropagate(t *testing.T) {
	repo := &fakeProvisionRepo{}
	provider := aitest.New()
	provider.Err = errors.New("boom")
	p := ai.NewProvisioner(repo, newFakeRedis(), provider, testLogger())

	err := p.Provision(context.Background(), 1, "leetcode", "two-sum")
	if err == nil {
		t.Fatal("expected an error to propagate")
	}
	if repo.logs[0] != "failed" {
		t.Fatalf("logs = %v, want [failed]", repo.logs)
	}
	if len(repo.upserted) != 0 {
		t.Fatalf("expected no cards stored, got %d", len(repo.upserted))
	}
}

// TestProvisioner_Provision_InvalidGenerationNotPersisted guards the "мусор
// в БД не пишем" contract at the Provisioner boundary: a Provider that fails
// strict validation (e.g. GeminiProvider after exhausting its retry) must
// never reach UpsertGeneratedCards.
func TestProvisioner_Provision_InvalidGenerationNotPersisted(t *testing.T) {
	repo := &fakeProvisionRepo{}
	provider := aitest.New()
	provider.Err = errors.New("ai: model returned 2 cards, want exactly 3")
	p := ai.NewProvisioner(repo, newFakeRedis(), provider, testLogger())

	if err := p.Provision(context.Background(), 1, "leetcode", "two-sum"); err == nil {
		t.Fatal("expected the validation failure to propagate")
	}
	if len(repo.upserted) != 0 {
		t.Fatalf("expected no cards stored for an invalid generation, got %d", len(repo.upserted))
	}
}

func TestProvisioner_ProvisionAsync_ConcurrentCallsGenerateOnce(t *testing.T) {
	repo := &fakeProvisionRepo{info: ai.ProblemInfo{Title: "Two Sum", Platform: "leetcode", Slug: "two-sum"}}
	provider := aitest.New()
	redis := newFakeRedis() // shared, like Redis would be across concurrent requests
	p := ai.NewProvisioner(repo, redis, provider, testLogger())

	const workers = 8
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_ = p.Provision(context.Background(), 1, "leetcode", "two-sum")
		}()
	}
	close(start)
	wg.Wait()

	if provider.Calls() != 1 {
		t.Fatalf("provider calls = %d, want exactly 1 under concurrent provisioning", provider.Calls())
	}
	if len(repo.upserted) != 3 {
		t.Fatalf("upserted %d cards, want 3", len(repo.upserted))
	}
}

func TestProvisioner_Ensure_ReadyFromRepoWarmsCache(t *testing.T) {
	repo := &fakeProvisionRepo{info: ai.ProblemInfo{Platform: "leetcode", Slug: "two-sum"}, readyVersion: "fake-v1"}
	provider := aitest.New()
	redis := newFakeRedis()
	p := ai.NewProvisioner(repo, redis, provider, testLogger())

	status, err := p.Ensure(context.Background(), 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status != ai.EnsureReady {
		t.Fatalf("status = %q, want %q", status, ai.EnsureReady)
	}
	if provider.Calls() != 0 {
		t.Fatalf("expected no generation, got %d calls", provider.Calls())
	}

	key := ai.CacheKey(provider.PromptVersion(), "leetcode", "two-sum")
	if _, err := redis.Get(context.Background(), key); err != nil {
		t.Fatalf("expected the readiness cache to be warmed, got: %v", err)
	}
}

func TestProvisioner_Ensure_ReadyFromCacheSkipsRepo(t *testing.T) {
	repo := &fakeProvisionRepo{info: ai.ProblemInfo{Platform: "leetcode", Slug: "two-sum"}}
	provider := aitest.New()
	redis := newFakeRedis()
	key := ai.CacheKey(provider.PromptVersion(), "leetcode", "two-sum")
	if err := redis.Save(context.Background(), key, "1", time.Hour); err != nil {
		t.Fatalf("seed cache: %v", err)
	}
	p := ai.NewProvisioner(repo, redis, provider, testLogger())

	status, err := p.Ensure(context.Background(), 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status != ai.EnsureReady {
		t.Fatalf("status = %q, want %q (repo has no ready cards, only the cache does)", status, ai.EnsureReady)
	}
}

func TestProvisioner_Ensure_StartsGenerationWhenNotReady(t *testing.T) {
	repo := &fakeProvisionRepo{info: ai.ProblemInfo{Title: "Two Sum", Platform: "leetcode", Slug: "two-sum"}}
	provider := aitest.New()
	p := ai.NewProvisioner(repo, newFakeRedis(), provider, testLogger())

	status, err := p.Ensure(context.Background(), 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status != ai.EnsureGenerating {
		t.Fatalf("status = %q, want %q", status, ai.EnsureGenerating)
	}

	deadline := time.Now().Add(2 * time.Second)
	for repo.upsertedCount() == 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if got := repo.upsertedCount(); got != 3 {
		t.Fatalf("expected the async generation kicked off by Ensure to store 3 cards, got %d", got)
	}
}

func TestProvisioner_Ensure_GeneratingWhenLockAlreadyHeld(t *testing.T) {
	repo := &fakeProvisionRepo{info: ai.ProblemInfo{Platform: "leetcode", Slug: "two-sum"}}
	provider := aitest.New()
	redis := newFakeRedis()
	if _, err := redis.TryLock(context.Background(), ai.LockKey("leetcode", "two-sum"), time.Minute); err != nil {
		t.Fatalf("seed lock: %v", err)
	}
	p := ai.NewProvisioner(repo, redis, provider, testLogger())

	status, err := p.Ensure(context.Background(), 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status != ai.EnsureGenerating {
		t.Fatalf("status = %q, want %q", status, ai.EnsureGenerating)
	}

	time.Sleep(20 * time.Millisecond) // let any stray goroutine run; there should be none
	if provider.Calls() != 0 {
		t.Fatalf("expected no new generation attempt while another is in flight, got %d calls", provider.Calls())
	}
}

func TestProvisioner_Ensure_ProblemNotFound(t *testing.T) {
	repo := &fakeProvisionRepo{infoErr: ai.ErrProblemNotFound}
	provider := aitest.New()
	p := ai.NewProvisioner(repo, newFakeRedis(), provider, testLogger())

	if _, err := p.Ensure(context.Background(), 999); !errors.Is(err, ai.ErrProblemNotFound) {
		t.Fatalf("err = %v, want ErrProblemNotFound", err)
	}
}

// TestProvisioner_Provision_InvalidGenerationNotPersisted (above) covers the
// mirror requirement for a real Provider; this covers the repo-level fake's
// own contract, i.e. a Provisioner constructed for Ensure() should also
// never call UpsertGeneratedCards after Ensure alone (Ensure does not
// generate synchronously — only Provision/ProvisionAsync do).
func TestProvisioner_Ensure_DoesNotBlockOnGeneration(t *testing.T) {
	repo := &fakeProvisionRepo{info: ai.ProblemInfo{Title: "Two Sum", Platform: "leetcode", Slug: "two-sum"}}
	provider := aitest.New()
	provider.Delay = 200 * time.Millisecond
	p := ai.NewProvisioner(repo, newFakeRedis(), provider, testLogger())

	start := time.Now()
	status, err := p.Ensure(context.Background(), 1)
	elapsed := time.Since(start)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status != ai.EnsureGenerating {
		t.Fatalf("status = %q, want %q", status, ai.EnsureGenerating)
	}
	if elapsed >= provider.Delay {
		t.Fatalf("Ensure took %v, expected it to return before the %v generation delay elapses", elapsed, provider.Delay)
	}
}
