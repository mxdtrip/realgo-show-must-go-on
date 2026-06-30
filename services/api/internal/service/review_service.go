package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/open-spaced-repetition/go-fsrs/v3"

	"github.com/mxdtrip/freeburger/services/api/internal/controller/v1/response"
	"github.com/mxdtrip/freeburger/services/api/internal/entity"
	"github.com/mxdtrip/freeburger/services/api/internal/repo"
)

var (
	ErrReviewNotFound = errors.New("review not found")
	ErrInvalidRating  = errors.New("invalid rating: must be hard, normal, or easy")
)

const todayReviewsLimit = 100

// ReviewService — бизнес-логика для повторений.
type ReviewService interface {
	GetQueue(ctx context.Context, userID int64, status string, limit int32) (response.QueueResponse, error)
	RateReview(ctx context.Context, reviewID, userID int64, rating string) (response.RateReviewResponse, error)
	GetStats(ctx context.Context, userID int64) (response.StatsResponse, error)
}

type reviewService struct {
	repo   repo.ReviewRepository
	fsrs   *fsrs.FSRS
	logger *slog.Logger
}

func NewReviewService(repo repo.ReviewRepository, logger *slog.Logger) ReviewService {
	return &reviewService{
		repo:   repo,
		fsrs:   fsrs.NewFSRS(fsrs.DefaultParam()),
		logger: logger,
	}
}

func (s *reviewService) GetQueue(ctx context.Context, userID int64, status string, limit int32) (response.QueueResponse, error) {
	items, err := s.repo.TodayReviews(ctx, userID, limit)
	if err != nil {
		return response.QueueResponse{}, fmt.Errorf("reviews: GetQueue: %w", err)
	}

	// Конвертируем entity в response
	data := make([]response.ReviewItem, 0, len(items))
	for _, item := range items {
		data = append(data, response.ReviewItem{
			ID:         item.ID,
			EntityType: item.EntityType,
			EntityID:   item.EntityID,
			Title:      item.Title,
			Meta:       item.Meta,
			TypeLabel:  item.TypeLabel,
			DueAt:      item.DueAt,
			Status:     item.Status,
			LastRating: item.LastRating,
			Attempts:   item.Attempts,
		})
	}

	return response.QueueResponse{
		Data: data,
		Meta: response.QueueMeta{NextCursor: nil},
	}, nil
}

func (s *reviewService) RateReview(ctx context.Context, reviewID, userID int64, rating string) (response.RateReviewResponse, error) {
	fsrsRating, err := toFsrsRating(rating)
	if err != nil {
		return response.RateReviewResponse{}, fmt.Errorf("reviews: RateReview: %w", err)
	}

	schedule, err := s.repo.ScheduleByID(ctx, reviewID, userID)
	if err != nil {
		if errors.Is(err, repo.ErrReviewNotFound) {
			return response.RateReviewResponse{}, ErrReviewNotFound
		}
		return response.RateReviewResponse{}, fmt.Errorf("reviews: RateReview: %w", err)
	}

	now := time.Now()
	info := s.fsrs.Next(scheduleToCard(schedule), now, fsrsRating)

	next := applyCard(schedule, info.Card, rating, now)
	next, err = s.repo.SaveReview(ctx, next, entity.ReviewAttempt{
		UserID:      schedule.UserID,
		ProblemID:   schedule.ProblemID,
		PatternID:   schedule.PatternID,
		Rating:      rating,
		DurationSec: 0, // TODO: получать из запроса
	})
	if err != nil {
		return response.RateReviewResponse{}, fmt.Errorf("reviews: RateReview: %w", err)
	}

	return response.RateReviewResponse{
		ReviewID:     next.ID,
		Rating:       rating,
		NextReviewAt: next.NextReviewAt,
		Status:       "completed",
	}, nil
}

func (s *reviewService) GetStats(ctx context.Context, userID int64) (response.StatsResponse, error) {
	stats, err := s.repo.Stats(ctx, userID)
	if err != nil {
		return response.StatsResponse{}, fmt.Errorf("reviews: GetStats: %w", err)
	}
	return response.StatsResponse{
		TotalReviews:  stats.TotalReviews,
		NewCards:      stats.NewCards,
		LearningCards: stats.LearningCards,
		ReviewCards:   stats.ReviewCards,
	}, nil
}

func toFsrsRating(rating string) (fsrs.Rating, error) {
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

func scheduleToCard(s entity.ReviewSchedule) fsrs.Card {
	lastReview := s.NextReviewAt
	if s.LastReviewAt != nil {
		lastReview = *s.LastReviewAt
	}

	return fsrs.Card{
		Due:           s.NextReviewAt,
		Stability:     s.Stability,
		Difficulty:    s.Difficulty,
		ScheduledDays: uint64(math.Max(0, math.Round(s.IntervalDays))),
		Reps:          uint64(max(0, s.ReviewCount)),
		Lapses:        uint64(max(0, s.Lapses)),
		State:         fsrs.State(s.State),
		LastReview:    lastReview,
	}
}

func applyCard(s entity.ReviewSchedule, card fsrs.Card, rating string, reviewedAt time.Time) entity.ReviewSchedule {
	s.NextReviewAt = card.Due
	s.IntervalDays = float64(card.ScheduledDays)
	s.Stability = card.Stability
	s.Difficulty = card.Difficulty
	s.ReviewCount = int(card.Reps)
	s.LastRating = &rating
	s.State = int8(card.State)
	s.Lapses = int(card.Lapses)
	s.LastReviewAt = &reviewedAt
	return s
}
