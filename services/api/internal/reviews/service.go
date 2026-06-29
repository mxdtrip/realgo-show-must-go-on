package reviews

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/open-spaced-repetition/go-fsrs/v4"
)

const todayReviewsLimit = 100

// Repository is the persistence the service depends on. It is declared here, at
// the point of use, so the storage layer can satisfy it without the service
// importing a concrete database package.
type Repository interface {
	TodayReviews(ctx context.Context, userID int64, limit int32) ([]ReviewItem, error)
	ScheduleByID(ctx context.Context, scheduleID, userID int64) (ReviewSchedule, error)
	SaveReview(ctx context.Context, schedule ReviewSchedule, attempt ReviewAttempt) (ReviewSchedule, error)
	Stats(ctx context.Context, userID int64) (StatsData, error)
}

type service struct {
	repo   Repository
	fsrs   *fsrs.FSRS
	logger *slog.Logger
}

func NewService(repo Repository, logger *slog.Logger) *service {
	return &service{
		repo:   repo,
		fsrs:   fsrs.NewFSRS(fsrs.DefaultParam()),
		logger: logger,
	}
}

func (s *service) GetTodayReviews(ctx context.Context, userID int64) ([]ReviewItem, error) {
	items, err := s.repo.TodayReviews(ctx, userID, todayReviewsLimit)
	if err != nil {
		return nil, fmt.Errorf("reviews: GetTodayReviews: %w", err)
	}
	return items, nil
}

func (s *service) ProcessAttempt(ctx context.Context, scheduleID, userID int64, req AttemptRequest) (AttemptResponse, error) {
	rating, err := fsrsRating(req.Rating)
	if err != nil {
		return AttemptResponse{}, fmt.Errorf("reviews: ProcessAttempt: %w", err)
	}

	schedule, err := s.repo.ScheduleByID(ctx, scheduleID, userID)
	if err != nil {
		return AttemptResponse{}, fmt.Errorf("reviews: ProcessAttempt: %w", err)
	}

	now := time.Now()
	info, err := s.fsrs.Next(schedule.card(), now, rating)
	if err != nil {
		return AttemptResponse{}, fmt.Errorf("reviews: ProcessAttempt: %w", err)
	}

	next := schedule.apply(info.Card, req.Rating, now)
	next, err = s.repo.SaveReview(ctx, next, ReviewAttempt{
		ReviewBase:  schedule.ReviewBase,
		Rating:      req.Rating,
		DurationSec: req.DurationSec,
	})
	if err != nil {
		return AttemptResponse{}, fmt.Errorf("reviews: ProcessAttempt: %w", err)
	}

	return AttemptResponse{
		ScheduleID:   next.ID,
		NextReviewAt: next.NextReviewAt,
		IntervalDays: next.IntervalDays,
		Stability:    next.Stability,
		Difficulty:   next.Difficulty,
		State:        next.State,
		Reps:         next.ReviewCount,
		Lapses:       next.Lapses,
	}, nil
}

func (s *service) GetStats(ctx context.Context, userID int64) (StatsData, error) {
	stats, err := s.repo.Stats(ctx, userID)
	if err != nil {
		return StatsData{}, fmt.Errorf("reviews: GetStats: %w", err)
	}
	return stats, nil
}

func fsrsRating(rating string) (fsrs.Rating, error) {
	switch rating {
	case "hard":
		return fsrs.Hard, nil
	case "normal":
		return fsrs.Good, nil
	case "easy":
		return fsrs.Easy, nil
	default:
		return 0, ErrInvalidRating
	}
}

func (s ReviewSchedule) card() fsrs.Card {
	lastReview := s.NextReviewAt
	if s.LastReviewAt != nil {
		lastReview = *s.LastReviewAt
	}

	return fsrs.Card{
		Due:            s.NextReviewAt,
		Stability:      s.Stability,
		Difficulty:     s.Difficulty,
		ScheduledDays:  uint64(math.Max(0, math.Round(s.IntervalDays))),
		Reps:           uint64(max(0, s.ReviewCount)),
		Lapses:         uint64(max(0, s.Lapses)),
		State:          fsrs.State(s.State),
		LastReview:     lastReview,
		RemainingSteps: s.RemainingSteps,
	}
}

func (s ReviewSchedule) apply(card fsrs.Card, rating string, reviewedAt time.Time) ReviewSchedule {
	s.NextReviewAt = card.Due
	s.IntervalDays = float64(card.ScheduledDays)
	s.Stability = card.Stability
	s.Difficulty = card.Difficulty
	s.ReviewCount = int(card.Reps)
	s.LastRating = &rating
	s.State = int8(card.State)
	s.Lapses = int(card.Lapses)
	s.LastReviewAt = &reviewedAt
	s.RemainingSteps = card.RemainingSteps
	return s
}
