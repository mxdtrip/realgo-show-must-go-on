package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/entity"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

var (
	ErrReviewNotFound = errors.New("review not found")
	ErrInvalidRating  = errors.New("invalid rating: must be hard, normal, or easy")
	ErrInvalidTarget  = errors.New("review target must have exactly one of problem_id or pattern_id")
)

type pgReviewRepository struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewReviewRepository(pool *pgxpool.Pool) ReviewRepository {
	return &pgReviewRepository{pool: pool, q: db.New(pool)}
}

func (r *pgReviewRepository) TodayReviews(ctx context.Context, userID int64, limit int32) ([]entity.ReviewItem, error) {
	rows, err := r.q.GetTodayReviews(ctx, db.GetTodayReviewsParams{UserID: userID, Limit: limit})
	if err != nil {
		return nil, fmt.Errorf("reviews: query today reviews: %w", err)
	}

	items := make([]entity.ReviewItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, entity.ReviewItem{
			ID:         row.ID,
			EntityType: entityType(row),
			EntityID:   entityID(row),
			Title:      row.ProblemTitle.String,
			Meta:       buildMeta(row),
			TypeLabel:  typeLabel(row),
			DueAt:      row.NextReviewAt.Time,
			Status:     statusFromState(int8(row.State)),
			LastRating: stringPtrFromPg(row.LastRating),
			Attempts:   int(row.ReviewCount.Int32),
		})
	}
	return items, nil
}

func (r *pgReviewRepository) ScheduleByID(ctx context.Context, scheduleID, userID int64) (entity.ReviewSchedule, error) {
	row, err := r.q.GetReviewScheduleByID(ctx, db.GetReviewScheduleByIDParams{ID: scheduleID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return entity.ReviewSchedule{}, ErrReviewNotFound
	}
	if err != nil {
		return entity.ReviewSchedule{}, fmt.Errorf("reviews: query schedule: %w", err)
	}
	return scheduleFromRow(row), nil
}

func (r *pgReviewRepository) SaveReview(ctx context.Context, schedule entity.ReviewSchedule, attempt entity.ReviewAttempt) (entity.ReviewSchedule, error) {
	kind, err := reviewType(attempt)
	if err != nil {
		return entity.ReviewSchedule{}, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return entity.ReviewSchedule{}, fmt.Errorf("reviews: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	q := r.q.WithTx(tx)
	updated, err := q.UpdateReviewSchedule(ctx, db.UpdateReviewScheduleParams{
		ID:             schedule.ID,
		NextReviewAt:   toPgTimestamptz(schedule.NextReviewAt),
		IntervalDays:   schedule.IntervalDays,
		Stability:      schedule.Stability,
		Difficulty:     schedule.Difficulty,
		ReviewCount:    toPgInt4(schedule.ReviewCount),
		LastRating:     toPgText(schedule.LastRating),
		State:          int16(schedule.State),
		Lapses:         int32(schedule.Lapses),
		LastReviewAt:   toPgNullableTimestamptz(schedule.LastReviewAt),
		RemainingSteps: int32(schedule.RemainingSteps),
	})
	if err != nil {
		return entity.ReviewSchedule{}, fmt.Errorf("reviews: update schedule: %w", err)
	}

	if _, err := q.CreateReviewAttempt(ctx, db.CreateReviewAttemptParams{
		UserID:      attempt.UserID,
		ProblemID:   toPgInt8(attempt.ProblemID),
		PatternID:   toPgInt8(attempt.PatternID),
		Rating:      attempt.Rating,
		ReviewType:  kind,
		DurationSec: toPgInt4(attempt.DurationSec),
		WasCorrect:  pgtype.Bool{},
	}); err != nil {
		return entity.ReviewSchedule{}, fmt.Errorf("reviews: create attempt: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return entity.ReviewSchedule{}, fmt.Errorf("reviews: commit tx: %w", err)
	}
	return scheduleFromUpdate(updated), nil
}

func (r *pgReviewRepository) Stats(ctx context.Context, userID int64) (entity.StatsData, error) {
	row, err := r.q.GetReviewStats(ctx, userID)
	if err != nil {
		return entity.StatsData{}, fmt.Errorf("reviews: query stats: %w", err)
	}
	return entity.StatsData{
		TotalReviews:  int(row.TotalReviews),
		NewCards:      int(row.NewCards),
		LearningCards: int(row.LearningCards),
		ReviewCards:   int(row.ReviewCards),
	}, nil
}

// Helper functions

func entityType(row db.GetTodayReviewsRow) string {
	if row.ProblemID.Valid {
		return "problem"
	}
	return "pattern"
}

func entityID(row db.GetTodayReviewsRow) int64 {
	if row.ProblemID.Valid {
		return row.ProblemID.Int64
	}
	return row.PatternID.Int64
}

func buildMeta(row db.GetTodayReviewsRow) string {
	if row.ProblemTitle.Valid && row.PatternTitle.Valid {
		return fmt.Sprintf("%s · %s", row.PatternTitle.String, difficultyFromState(int8(row.State)))
	}
	if row.PatternTitle.Valid {
		return row.PatternTitle.String
	}
	return ""
}

func typeLabel(row db.GetTodayReviewsRow) string {
	if row.ProblemID.Valid {
		return "problem review"
	}
	return "pattern review"
}

func statusFromState(state int8) string {
	switch state {
	case 0:
		return "due"
	case 1:
		return "due"
	case 2:
		return "due"
	case 3:
		return "due"
	default:
		return "due"
	}
}

func difficultyFromState(state int8) string {
	// TODO: получать сложность из problems.difficulty
	return "medium"
}

func reviewType(attempt entity.ReviewAttempt) (string, error) {
	switch {
	case attempt.ProblemID != nil && attempt.PatternID == nil:
		return "problem", nil
	case attempt.ProblemID == nil && attempt.PatternID != nil:
		return "pattern", nil
	default:
		return "", ErrInvalidTarget
	}
}

func scheduleFromRow(row db.GetReviewScheduleByIDRow) entity.ReviewSchedule {
	return entity.ReviewSchedule{
		ID:             row.ID,
		UserID:         row.UserID,
		ProblemID:      int64PtrFromPg(row.ProblemID),
		PatternID:      int64PtrFromPg(row.PatternID),
		NextReviewAt:   row.NextReviewAt.Time,
		IntervalDays:   row.IntervalDays,
		Stability:      row.Stability,
		Difficulty:     row.Difficulty,
		ReviewCount:    int(row.ReviewCount.Int32),
		LastRating:     stringPtrFromPg(row.LastRating),
		State:          int8(row.State),
		Lapses:         int(row.Lapses),
		LastReviewAt:   timePtrFromPg(row.LastReviewAt),
		RemainingSteps: int(row.RemainingSteps),
	}
}

func scheduleFromUpdate(row db.UpdateReviewScheduleRow) entity.ReviewSchedule {
	return entity.ReviewSchedule{
		ID:             row.ID,
		UserID:         row.UserID,
		ProblemID:      int64PtrFromPg(row.ProblemID),
		PatternID:      int64PtrFromPg(row.PatternID),
		NextReviewAt:   row.NextReviewAt.Time,
		IntervalDays:   row.IntervalDays,
		Stability:      row.Stability,
		Difficulty:     row.Difficulty,
		ReviewCount:    int(row.ReviewCount.Int32),
		LastRating:     stringPtrFromPg(row.LastRating),
		State:          int8(row.State),
		Lapses:         int(row.Lapses),
		LastReviewAt:   timePtrFromPg(row.LastReviewAt),
		RemainingSteps: int(row.RemainingSteps),
	}
}

func int64PtrFromPg(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}

func stringPtrFromPg(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func timePtrFromPg(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}

func toPgInt8(value *int64) pgtype.Int8 {
	if value == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *value, Valid: true}
}

func toPgInt4(value int) pgtype.Int4 {
	return pgtype.Int4{Int32: int32(value), Valid: true}
}

func toPgText(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func toPgTimestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}

func toPgNullableTimestamptz(value *time.Time) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *value, Valid: true}
}
