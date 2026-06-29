package reviews

import (
	"context"
	"errors"
	"log/slog"

	"github.com/open-spaced-repetition/go-fsrs/v4"
)

var (
	ErrReviewNotFound = errors.New("review schedule not found")
	ErrInvalidRating  = errors.New("invalid rating: must be 1-4")
	ErrInvalidRequest = errors.New("invalid request body")
)

type Service interface {
	GetTodayReviews(ctx context.Context, userID int64) ([]ReviewItem, error)
	ProcessAttempt(ctx context.Context, scheduleID, userID int64, req AttemptRequest) (AttemptResponse, error)
	GetStats(ctx context.Context, userID int64) (StatsResponse, error)
}

type service struct {
	fsrs   *fsrs.FSRS
	logger *slog.Logger
}

func NewService(logger *slog.Logger) *service {
	return &service{
		fsrs:   fsrs.NewFSRS(fsrs.DefaultParam()),
		logger: logger,
	}
}

func (s *service) GetTodayReviews(ctx context.Context, userID int64) ([]ReviewItem, error) {
	return nil, errors.New("not implemented")
}

func (s *service) ProcessAttempt(ctx context.Context, scheduleID, userID int64, req AttemptRequest) (AttemptResponse, error) {
	return AttemptResponse{}, errors.New("not implemented")
}

func (s *service) GetStats(ctx context.Context, userID int64) (StatsResponse, error) {
	return StatsResponse{}, errors.New("not implemented")
}
