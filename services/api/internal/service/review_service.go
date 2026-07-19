package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/controller/v1/response"
	"github.com/mxdtrip/freeburger/services/api/internal/entity"
	"github.com/mxdtrip/freeburger/services/api/internal/repo"
	"github.com/mxdtrip/freeburger/services/api/internal/scheduler"
)

var (
	ErrReviewNotFound = errors.New("review not found")
	ErrInvalidRating  = errors.New("invalid rating: must be hard, normal, or easy")
)

const maxReviewSaveAttempts = 3

// ReviewService — бизнес-логика для повторений.
// Обёрнут в data согласно контракту
type ReviewService interface {
	GetQueue(ctx context.Context, userID int64, status string, cursor entity.ReviewQueueCursor, limit int32) (response.QueueResponse, error)
	RateReview(ctx context.Context, reviewID, userID int64, rating string, reviewedAt time.Time) (response.RateReviewData, error)
	// RateByProblemID оценивает задачу в FSRS по problem_id (без expose schedule
	// id): гарантирует наличие расписания и делегирует в RateReview. Используется
	// викториной, у которой есть только problem_id.
	RateByProblemID(ctx context.Context, userID, problemID int64, rating string, reviewedAt time.Time) error
	GetStats(ctx context.Context, userID int64) (response.StatsResponse, error)
}

type reviewService struct {
	repo   repo.ReviewRepository
	sched  scheduler.Scheduler
	logger *slog.Logger
}

// NewReviewService builds the review service with a shared FSRS scheduler.
// sched must be the same instance handed to the extension ingest path so that
// both scheduling routes (POST /extension/events and POST /me/reviews/*/rate,
// including the cards/quiz paths that funnel into RateReview) share one set of
// FSRS parameters. This is the FSRS-audit A1 invariant; the
// FSRSPathsShareAlgorithm acceptance spec pins it down.
func NewReviewService(repo repo.ReviewRepository, sched scheduler.Scheduler, logger *slog.Logger) ReviewService {
	return &reviewService{
		repo:   repo,
		sched:  sched,
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
			ID:          item.ID,
			EntityType:  item.EntityType,
			EntityID:    item.EntityID,
			Title:       item.Title,
			Meta:        item.Meta,
			TypeLabel:   item.TypeLabel,
			DueAt:       item.DueAt,
			Status:      item.Status,
			LastRating:  item.LastRating,
			Attempts:    item.Attempts,
			EntityURL:   item.EntityURL,
			PatternCode: item.PatternCode,
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
	// Validate the rating up front: the scheduler would also reject it, but
	// surfacing ErrInvalidRating before touching the DB keeps the existing
	// service contract (TestReviewService_RateReview_InvalidRating relies on it).
	if !scheduler.Rating(rating).Valid() {
		return response.RateReviewData{}, fmt.Errorf("reviews: RateReview: %w", ErrInvalidRating)
	}

	var schedule, next entity.ReviewSchedule
	var err error
	for attemptNumber := 0; attemptNumber < maxReviewSaveAttempts; attemptNumber++ {
		schedule, err = s.repo.ScheduleByID(ctx, reviewID, userID)
		if err != nil {
			if errors.Is(err, repo.ErrReviewNotFound) {
				return response.RateReviewData{}, ErrReviewNotFound
			}
			return response.RateReviewData{}, fmt.Errorf("reviews: RateReview: %w", err)
		}

		decision, derr := s.sched.NextWithState(scheduleToState(schedule), scheduler.Rating(rating), reviewedAt)
		if derr != nil {
			return response.RateReviewData{}, fmt.Errorf("reviews: RateReview: %w", derr)
		}
		next = applyDecision(schedule, decision, reviewedAt)
		next, err = s.repo.SaveReview(ctx, next, entity.ReviewAttempt{
			UserID:      schedule.UserID,
			ProblemID:   schedule.ProblemID,
			PatternID:   schedule.PatternID,
			CardID:      schedule.CardID,
			Rating:      rating,
			DurationSec: 0, // TODO: получать из запроса
		}, schedule.ReviewCount)
		if err == nil {
			break
		}
		if !errors.Is(err, repo.ErrReviewConflict) {
			return response.RateReviewData{}, fmt.Errorf("reviews: RateReview: %w", err)
		}
	}
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

// RateByProblemID оценивает задачу в FSRS, отправленную на оценку по problem_id
// (а не по schedule id): гарантирует наличие расписания и переиспользует
// RateReview, который прогоняет FSRS, сохраняет результат и обновляет confidence.
func (s *reviewService) RateByProblemID(ctx context.Context, userID, problemID int64, rating string, reviewedAt time.Time) error {
	scheduleID, err := s.repo.EnsureScheduleForProblem(ctx, userID, problemID)
	if err != nil {
		return fmt.Errorf("reviews: RateByProblemID: %w", err)
	}
	if _, err := s.RateReview(ctx, scheduleID, userID, rating, reviewedAt); err != nil {
		return fmt.Errorf("reviews: RateByProblemID: %w", err)
	}
	return nil
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

// scheduleToState rebuilds the scheduler.SchedulerState from the persisted
// schedule so the shared FSRS scheduler can continue from prior history. This
// is the only place the service layer translates entity ↔ scheduler DTO; the
// go-fsrs Card mapping lives in the scheduler package now (A1 unification).
func scheduleToState(s entity.ReviewSchedule) scheduler.SchedulerState {
	state := scheduler.SchedulerState{
		Stability:     s.Stability,
		Difficulty:    s.Difficulty,
		Ease:          2.5, // legacy column, FSRS ignores it; kept for schema compat
		ScheduledDays: uint64(math.Max(0, math.Round(s.IntervalDays))),
		Reps:          uint64(max(0, s.ReviewCount)),
		Lapses:        uint64(max(0, s.Lapses)),
		State:         s.State,
		Due:           s.NextReviewAt,
	}
	if s.LastReviewAt != nil {
		state.LastReview = *s.LastReviewAt
	} else {
		// Match the pre-refactor scheduleToCard fallback: absent LastReview
		// falls back to Due so FSRS' elapsed-days math stays well-defined.
		state.LastReview = s.NextReviewAt
	}
	return state
}

// applyDecision writes the scheduler's Decision back into the schedule entity,
// preserving DB columns that FSRS does not own (Ease is untouched).
func applyDecision(s entity.ReviewSchedule, d scheduler.Decision, reviewedAt time.Time) entity.ReviewSchedule {
	rating := d.LastRating
	s.NextReviewAt = d.NextReviewAt
	s.IntervalDays = d.IntervalDays
	s.Stability = d.Stability
	s.Difficulty = d.Difficulty
	s.ReviewCount = d.Reps
	s.LastRating = &rating
	s.State = d.State
	s.Lapses = d.Lapses
	s.LastReviewAt = &reviewedAt
	return s
}
