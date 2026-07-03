package reviews

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

type pgRepository struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{pool: pool, q: db.New(pool)}
}

func (r *pgRepository) TodayReviews(ctx context.Context, userID int64, limit int32) ([]ReviewItem, error) {
	rows, err := r.q.GetTodayReviews(ctx, db.GetTodayReviewsParams{UserID: userID, Limit: limit})
	if err != nil {
		return nil, fmt.Errorf("reviews: query today reviews: %w", err)
	}

	items := make([]ReviewItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ReviewItem{
			ID:           row.ID,
			ProblemID:    int64PtrFromPg(row.ProblemID),
			PatternID:    int64PtrFromPg(row.PatternID),
			ProblemTitle: row.ProblemTitle.String,
			ProblemURL:   row.ProblemUrl.String,
			PatternTitle: row.PatternTitle,
			NextReviewAt: row.NextReviewAt.Time,
			State:        int8(row.State),
		})
	}
	return items, nil
}

func (r *pgRepository) ScheduleByID(ctx context.Context, scheduleID, userID int64) (ReviewSchedule, error) {
	row, err := r.q.GetReviewScheduleByID(ctx, db.GetReviewScheduleByIDParams{ID: scheduleID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return ReviewSchedule{}, ErrReviewNotFound
	}
	if err != nil {
		return ReviewSchedule{}, fmt.Errorf("reviews: query schedule: %w", err)
	}
	return scheduleFromRow(row), nil
}

func (r *pgRepository) SaveReview(ctx context.Context, schedule ReviewSchedule, attempt ReviewAttempt) (ReviewSchedule, error) {
	kind, err := reviewType(attempt.ReviewTarget)
	if err != nil {
		return ReviewSchedule{}, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return ReviewSchedule{}, fmt.Errorf("reviews: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	q := r.q.WithTx(tx)
	updated, err := q.UpdateReviewSchedule(ctx, db.UpdateReviewScheduleParams{
		ID:             schedule.ID,
		UserID:         schedule.UserID,
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
		return ReviewSchedule{}, fmt.Errorf("reviews: update schedule: %w", err)
	}

	if _, err := q.CreateReviewAttempt(ctx, db.CreateReviewAttemptParams{
		UserID:      attempt.UserID,
		ProblemID:   toPgInt8(attempt.ProblemID),
		PatternID:   toPgInt8(attempt.PatternID),
		CardID:      pgtype.Int8{},
		Rating:      attempt.Rating,
		ReviewType:  kind,
		DurationSec: toPgInt4(attempt.DurationSec),
		WasCorrect:  pgtype.Bool{},
	}); err != nil {
		return ReviewSchedule{}, fmt.Errorf("reviews: create attempt: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return ReviewSchedule{}, fmt.Errorf("reviews: commit tx: %w", err)
	}
	return scheduleFromUpdate(updated), nil
}

func reviewType(target ReviewTarget) (string, error) {
	switch {
	case target.ProblemID != nil && target.PatternID == nil:
		return "problem", nil
	case target.ProblemID == nil && target.PatternID != nil:
		return "pattern", nil
	default:
		return "", ErrInvalidTarget
	}
}

func (r *pgRepository) Stats(ctx context.Context, userID int64) (StatsData, error) {
	row, err := r.q.GetReviewStats(ctx, userID)
	if err != nil {
		return StatsData{}, fmt.Errorf("reviews: query stats: %w", err)
	}
	return StatsData{
		TotalReviews:  int(row.TotalReviews),
		NewCards:      int(row.NewCards),
		LearningCards: int(row.LearningCards),
		ReviewCards:   int(row.ReviewCards),
	}, nil
}

func scheduleFromRow(row db.GetReviewScheduleByIDRow) ReviewSchedule {
	return ReviewSchedule{
		ID:             row.ID,
		ReviewBase:     reviewBaseFromPg(row.UserID, row.ProblemID, row.PatternID),
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

func scheduleFromUpdate(row db.UpdateReviewScheduleRow) ReviewSchedule {
	return ReviewSchedule{
		ID:             row.ID,
		ReviewBase:     reviewBaseFromPg(row.UserID, row.ProblemID, row.PatternID),
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

func reviewBaseFromPg(userID int64, problemID, patternID pgtype.Int8) ReviewBase {
	return ReviewBase{
		UserID: userID,
		ReviewTarget: ReviewTarget{
			ProblemID: int64PtrFromPg(problemID),
			PatternID: int64PtrFromPg(patternID),
		},
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
