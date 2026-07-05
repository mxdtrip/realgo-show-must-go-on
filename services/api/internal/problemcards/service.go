package problemcards

import (
	"context"
	"fmt"

	"github.com/mxdtrip/freeburger/services/api/internal/ai"
	"github.com/mxdtrip/freeburger/services/api/internal/cards"
)

type repository interface {
	LockKeyParts(ctx context.Context, problemID int64) (platform, slug string, err error)
}

// cardsService is the behaviour needed from cards.Service: the cards a user
// can see for one problem (their own, plus global seed/AI cards).
type cardsService interface {
	ListByProblem(ctx context.Context, userID, problemID int64) ([]cards.Card, error)
}

// lockChecker is a read-only check of the CardProvisioner Redis lock;
// satisfied structurally by *redis.Storage.
type lockChecker interface {
	Locked(ctx context.Context, key string) (bool, error)
}

type Service struct {
	repo     repository
	cardsSvc cardsService
	lock     lockChecker
}

func NewService(repo repository, cardsSvc cardsService, lock lockChecker) *Service {
	return &Service{repo: repo, cardsSvc: cardsSvc, lock: lock}
}

// Get resolves the status contract for GET /me/problems/{problemId}/cards.
func (s *Service) Get(ctx context.Context, userID, problemID int64) (Response, error) {
	platform, slug, err := s.repo.LockKeyParts(ctx, problemID)
	if err != nil {
		return Response{}, err
	}

	items, err := s.cardsSvc.ListByProblem(ctx, userID, problemID)
	if err != nil {
		return Response{}, fmt.Errorf("problemcards: list cards: %w", err)
	}
	if len(items) > 0 {
		return Response{Status: StatusReady, Cards: items}, nil
	}

	generating, err := s.lock.Locked(ctx, ai.LockKey(platform, slug))
	if err != nil {
		return Response{}, fmt.Errorf("problemcards: check generation lock: %w", err)
	}
	if generating {
		return Response{Status: StatusGenerating, Cards: []cards.Card{}}, nil
	}
	return Response{Status: StatusNone, Cards: []cards.Card{}}, nil
}
