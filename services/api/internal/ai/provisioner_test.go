package ai_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/ai"
	"github.com/mxdtrip/freeburger/services/api/internal/ai/aitest"
)

type fakeProvisionRepo struct {
	mu          sync.Mutex
	globalCount int64
	info        ai.ProblemInfo
	infoErr     error
	upserted    []ai.GeneratedCard
	upsertErr   error
	logs        []string
}

func (f *fakeProvisionRepo) CountGlobalCards(context.Context, int64) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.globalCount, nil
}

func (f *fakeProvisionRepo) ProblemInfo(context.Context, int64) (ai.ProblemInfo, error) {
	if f.infoErr != nil {
		return ai.ProblemInfo{}, f.infoErr
	}
	return f.info, nil
}

func (f *fakeProvisionRepo) UpsertGeneratedCards(_ context.Context, _ int64, _, _ string, cards []ai.GeneratedCard, _ string) error {
	if f.upsertErr != nil {
		return f.upsertErr
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.upserted = append(f.upserted, cards...)
	f.globalCount += int64(len(cards))
	return nil
}

func (f *fakeProvisionRepo) LogGenerationRequest(_ context.Context, _, status string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.logs = append(f.logs, status)
	return nil
}

// fakeLocker mimics Redis SETNX semantics in-process for unit tests. It
// satisfies ai's unexported locker interface structurally.
type fakeLocker struct {
	mu     sync.Mutex
	locked map[string]bool
}

func newFakeLocker() *fakeLocker { return &fakeLocker{locked: map[string]bool{}} }

func (l *fakeLocker) TryLock(_ context.Context, key string, _ time.Duration) (bool, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.locked[key] {
		return false, nil
	}
	l.locked[key] = true
	return true, nil
}

func (l *fakeLocker) Unlock(_ context.Context, key string) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.locked, key)
	return nil
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestProvisioner_Provision_GeneratesAndStoresCards(t *testing.T) {
	repo := &fakeProvisionRepo{info: ai.ProblemInfo{Title: "Two Sum", Platform: "leetcode", Slug: "two-sum"}}
	provider := aitest.New()
	p := ai.NewProvisioner(repo, newFakeLocker(), provider, testLogger())

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
	repo := &fakeProvisionRepo{globalCount: 3}
	provider := aitest.New()
	p := ai.NewProvisioner(repo, newFakeLocker(), provider, testLogger())

	if err := p.Provision(context.Background(), 1, "leetcode", "two-sum"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if provider.Calls() != 0 {
		t.Fatalf("provider calls = %d, want 0 (idempotent no-op)", provider.Calls())
	}
}

func TestProvisioner_Provision_SkipsWhenLockHeld(t *testing.T) {
	repo := &fakeProvisionRepo{}
	provider := aitest.New()
	lock := newFakeLocker()
	_, _ = lock.TryLock(context.Background(), ai.LockKey("leetcode", "two-sum"), time.Minute)

	p := ai.NewProvisioner(repo, lock, provider, testLogger())
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
	p := ai.NewProvisioner(repo, newFakeLocker(), provider, testLogger())

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
	p := ai.NewProvisioner(repo, newFakeLocker(), provider, testLogger())

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
	p := ai.NewProvisioner(repo, newFakeLocker(), provider, testLogger())

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
	p := ai.NewProvisioner(repo, newFakeLocker(), provider, testLogger())

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
	lock := newFakeLocker() // shared, like Redis would be across concurrent requests
	p := ai.NewProvisioner(repo, lock, provider, testLogger())

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
