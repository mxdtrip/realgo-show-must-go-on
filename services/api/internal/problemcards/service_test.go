package problemcards

import (
	"context"
	"errors"
	"testing"

	"github.com/mxdtrip/freeburger/services/api/internal/ai"
	"github.com/mxdtrip/freeburger/services/api/internal/cards"
)

type fakeRepo struct {
	platform string
	slug     string
	err      error
}

func (f *fakeRepo) LockKeyParts(context.Context, int64) (string, string, error) {
	return f.platform, f.slug, f.err
}

type fakeCardsService struct {
	items []cards.Card
	err   error
}

func (f *fakeCardsService) ListByProblem(context.Context, int64, int64) ([]cards.Card, error) {
	return f.items, f.err
}

type fakeLock struct {
	locked map[string]bool
	err    error
}

func (f *fakeLock) Locked(_ context.Context, key string) (bool, error) {
	return f.locked[key], f.err
}

func TestService_Get_Ready(t *testing.T) {
	repo := &fakeRepo{platform: "leetcode", slug: "two-sum"}
	cardsSvc := &fakeCardsService{items: []cards.Card{{ID: 1}}}
	lock := &fakeLock{locked: map[string]bool{}}
	svc := NewService(repo, cardsSvc, lock)

	got, err := svc.Get(context.Background(), 1, 42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Status != StatusReady || len(got.Cards) != 1 {
		t.Fatalf("got %+v, want ready with 1 card", got)
	}
}

func TestService_Get_Generating(t *testing.T) {
	repo := &fakeRepo{platform: "leetcode", slug: "two-sum"}
	cardsSvc := &fakeCardsService{items: []cards.Card{}}
	lock := &fakeLock{locked: map[string]bool{ai.LockKey("leetcode", "two-sum"): true}}
	svc := NewService(repo, cardsSvc, lock)

	got, err := svc.Get(context.Background(), 1, 42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Status != StatusGenerating {
		t.Fatalf("status = %q, want generating", got.Status)
	}
	if got.Cards == nil || len(got.Cards) != 0 {
		t.Fatalf("cards = %v, want empty non-nil slice", got.Cards)
	}
}

func TestService_Get_None(t *testing.T) {
	repo := &fakeRepo{platform: "leetcode", slug: "two-sum"}
	cardsSvc := &fakeCardsService{items: []cards.Card{}}
	lock := &fakeLock{locked: map[string]bool{}}
	svc := NewService(repo, cardsSvc, lock)

	got, err := svc.Get(context.Background(), 1, 42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Status != StatusNone {
		t.Fatalf("status = %q, want none", got.Status)
	}
}

func TestService_Get_ProblemNotFound(t *testing.T) {
	repo := &fakeRepo{err: ErrProblemNotFound}
	svc := NewService(repo, &fakeCardsService{}, &fakeLock{})

	_, err := svc.Get(context.Background(), 1, 999)
	if !errors.Is(err, ErrProblemNotFound) {
		t.Fatalf("err = %v, want ErrProblemNotFound", err)
	}
}
