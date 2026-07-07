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
	ErrInvalidTarget  = errors.New("review target must have exactly one of problem_id, pattern_id, or card_id")
)

type pgReviewRepository struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewReviewRepository(pool *pgxpool.Pool) ReviewRepository {
	return &pgReviewRepository{pool: pool, q: db.New(pool)}
}

func (r *pgReviewRepository) QueueReviews(ctx context.Context, userID int64, status string, cursor entity.ReviewQueueCursor, limit int32) ([]entity.ReviewItem, error) {
	rows, err := r.q.ListReviewQueue(ctx, db.ListReviewQueueParams{
		UserID:             userID,
		Status:             status,
		CursorNextReviewAt: toPgTimestamptz(cursor.NextReviewAt),
		CursorID:           cursor.ID,
		QueueLimit:         limit,
	})
	if err != nil {
		return nil, fmt.Errorf("reviews: query review queue: %w", err)
	}

	items := make([]entity.ReviewItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, entity.ReviewItem{
			ID:         row.ID,
			EntityType: entityType(row.ProblemID, row.PatternID, row.CardID),
			EntityID:   entityID(row.ProblemID, row.PatternID, row.CardID),
			Title:      title(row.ProblemID, row.CardID, row.ProblemTitle, row.PatternTitle, row.CardQuestion),
			Meta:       buildMeta(row.CardID, row.PatternTitle, row.ProblemDifficulty, row.CardType),
			TypeLabel:  typeLabel(row.ProblemID, row.PatternID, row.CardID),
			DueAt:      row.NextReviewAt.Time,
			Status:     status,
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

func (r *pgReviewRepository) SaveReview(ctx context.Context, schedule entity.ReviewSchedule, attempt entity.ReviewAttempt) (saved entity.ReviewSchedule, err error) {
	kind, err := reviewType(attempt)
	if err != nil {
		return entity.ReviewSchedule{}, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return entity.ReviewSchedule{}, fmt.Errorf("reviews: begin tx: %w", err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		if rollbackErr := tx.Rollback(ctx); rollbackErr != nil {
			err = errors.Join(err, fmt.Errorf("reviews: rollback tx: %w", rollbackErr))
		}
	}()

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
		return entity.ReviewSchedule{}, fmt.Errorf("reviews: update schedule: %w", err)
	}

	if _, err := q.CreateReviewAttempt(ctx, db.CreateReviewAttemptParams{
		UserID:      attempt.UserID,
		ProblemID:   toPgInt8(attempt.ProblemID),
		PatternID:   toPgInt8(attempt.PatternID),
		CardID:      toPgInt8(attempt.CardID),
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
	committed = true
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

// EnsureScheduleForProblem создаёт расписание задачи, если его ещё нет
// (CreateProblemScheduleIfAbsent идемпотентен благодаря ON CONFLICT DO NOTHING),
// и возвращает id расписания. Используется сервисом викторины, чтобы оценить
// задачу в FSRS по problem_id (у quiz есть только problem_id, не schedule id).
func (r *pgReviewRepository) EnsureScheduleForProblem(ctx context.Context, userID, problemID int64) (int64, error) {
	if err := r.q.CreateProblemScheduleIfAbsent(ctx, db.CreateProblemScheduleIfAbsentParams{
		UserID:    userID,
		ProblemID: problemID,
	}); err != nil {
		return 0, fmt.Errorf("reviews: ensure schedule create: %w", err)
	}
	id, err := r.q.GetReviewScheduleIDByProblem(ctx, db.GetReviewScheduleIDByProblemParams{
		UserID:    userID,
		ProblemID: pgtype.Int8{Int64: problemID, Valid: true},
	})
	if err != nil {
		return 0, fmt.Errorf("reviews: ensure schedule lookup: %w", err)
	}
	return id, nil
}

// UpdateProgressConfidence обновляет confidence по задаче.
func (r *pgReviewRepository) UpdateProgressConfidence(ctx context.Context, userID, problemID int64, rating string) error {
	delta := confidenceDelta(rating)
	if delta == 0 {
		return nil
	}
	err := r.q.UpdateProgressConfidence(ctx, db.UpdateProgressConfidenceParams{
		UserID:    userID,
		ProblemID: problemID,
		Column3:   int32(delta),
	})
	return err
}

// confidenceDelta возвращает изменение confidence на основе рейтинга.
func confidenceDelta(rating string) int {
	switch rating {
	case "easy":
		return 10
	case "hard":
		return -10
	default:
		return 0
	}
}

// Helper functions

func entityType(problemID, patternID, cardID pgtype.Int8) string {
	if problemID.Valid {
		return "problem"
	}
	if patternID.Valid {
		return "pattern"
	}
	if cardID.Valid {
		return "card"
	}
	return ""
}

func entityID(problemID, patternID, cardID pgtype.Int8) int64 {
	if problemID.Valid {
		return problemID.Int64
	}
	if cardID.Valid {
		return cardID.Int64
	}
	if !patternID.Valid {
		return 0
	}
	return patternID.Int64
}

func title(problemID, cardID pgtype.Int8, problemTitle pgtype.Text, patternTitle string, cardQuestion pgtype.Text) string {
	if cardID.Valid && cardQuestion.Valid && cardQuestion.String != "" {
		return cardQuestion.String
	}
	if problemID.Valid {
		return problemTitle.String
	}
	return patternTitle
}

func buildMeta(cardID pgtype.Int8, patternTitle string, problemDifficulty pgtype.Text, cardType string) string {
	if cardID.Valid {
		if patternTitle != "" && cardType != "" {
			return fmt.Sprintf("%s · %s", patternTitle, cardType)
		}
		if cardType != "" {
			return cardType
		}
		if patternTitle != "" {
			return patternTitle
		}
		return "card"
	}

	difficulty := "unknown"
	if problemDifficulty.Valid && problemDifficulty.String != "" {
		difficulty = problemDifficulty.String
	}
	if patternTitle != "" {
		return fmt.Sprintf("%s · %s", patternTitle, difficulty)
	}
	return difficulty
}

func typeLabel(problemID, patternID, cardID pgtype.Int8) string {
	if problemID.Valid {
		return "problem review"
	}
	if patternID.Valid {
		return "pattern review"
	}
	if cardID.Valid {
		return "card review"
	}
	return ""
}

func reviewType(attempt entity.ReviewAttempt) (string, error) {
	switch {
	case attempt.ProblemID != nil && attempt.PatternID == nil && attempt.CardID == nil:
		return "problem", nil
	case attempt.ProblemID == nil && attempt.PatternID != nil && attempt.CardID == nil:
		return "pattern", nil
	case attempt.ProblemID == nil && attempt.PatternID == nil && attempt.CardID != nil:
		return "card", nil
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
		CardID:         int64PtrFromPg(row.CardID),
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
		CardID:         int64PtrFromPg(row.CardID),
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
