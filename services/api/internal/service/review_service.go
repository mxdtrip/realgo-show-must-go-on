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

// ReviewService — бизнес-логика для повторений.
// Обёрнут в data согласно контракту
type ReviewService interface {
	GetQueue(ctx context.Context, userID int64, status string, cursor entity.ReviewQueueCursor, limit int32) (response.QueueResponse, error)
	RateReview(ctx context.Context, reviewID, userID int64, rating string, reviewedAt time.Time) (response.RateReviewData, error)
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

func (s *reviewService) GetQueue(ctx context.Context, userID int64, status string, cursor entity.ReviewQueueCursor, limit int32) (response.QueueResponse, error) {
	// Запрашиваем на одну запись больше limit — если она пришла, значит есть
	// следующая страница, и её же используем как источник nextCursor.
	items, err := s.repo.QueueReviews(ctx, userID, status, cursor, limit+1)
	if err != nil {
		return response.QueueResponse{}, fmt.Errorf("reviews: GetQueue: %w", err)
	}

	hasMore := len(items) > int(limit)
	if hasMore {
		items = items[:limit]
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

	var nextCursor *string
	if hasMore && len(items) > 0 {
		last := items[len(items)-1]
		encoded, err := entity.EncodeReviewQueueCursor(entity.ReviewQueueCursor{NextReviewAt: last.DueAt, ID: last.ID})
		if err != nil {
			return response.QueueResponse{}, fmt.Errorf("reviews: GetQueue: %w", err)
		}
		nextCursor = &encoded
	}

	return response.QueueResponse{
		Data: data,
		Meta: response.QueueMeta{NextCursor: nextCursor},
	}, nil
}

func (s *reviewService) RateReview(ctx context.Context, reviewID, userID int64, rating string, reviewedAt time.Time) (response.RateReviewData, error) {
	fsrsRating, err := toFsrsRating(rating)
	if err != nil {
		return response.RateReviewData{}, fmt.Errorf("reviews: RateReview: %w", err)
	}

	schedule, err := s.repo.ScheduleByID(ctx, reviewID, userID)
	if err != nil {
		if errors.Is(err, repo.ErrReviewNotFound) {
			return response.RateReviewData{}, ErrReviewNotFound
		}
		return response.RateReviewData{}, fmt.Errorf("reviews: RateReview: %w", err)
	}

	info := s.fsrs.Next(scheduleToCard(schedule), reviewedAt, fsrsRating)

	next := applyCard(schedule, info.Card, rating, reviewedAt)
	next, err = s.repo.SaveReview(ctx, next, entity.ReviewAttempt{
		UserID:      schedule.UserID,
		ProblemID:   schedule.ProblemID,
		PatternID:   schedule.PatternID,
		CardID:      schedule.CardID,
		Rating:      rating,
		DurationSec: 0, // TODO: получать из запроса
	})
	if err != nil {
		return response.RateReviewData{}, fmt.Errorf("reviews: RateReview: %w", err)
	}

	// Обновляем confidence в user_problem_progress (только для problems)
	if schedule.ProblemID != nil {
		if err := s.repo.UpdateProgressConfidence(ctx, userID, *schedule.ProblemID, rating); err != nil {
			s.logger.Warn("failed to update confidence", "user_id", userID, "problem_id", *schedule.ProblemID, "error", err)
			// Не прерываем процесс, это не критичная ошибка
		}
	}

	return response.RateReviewData{
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
