package extension

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/scheduler"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

// algorithmFSRS marks every schedule written by the extension ingest as
// FSRS-owned, matching the review-service path.
const algorithmFSRS = "fsrs"

// IngestInput carries one already-validated event into the storage transaction.
// The scheduler Decision (FSRS fields, interval) is computed inside the
// repository at upsert time so it can read prior state atomically.
type IngestInput struct {
	UserID           int64
	PlatformID       int64
	Slug             string
	Title            string
	URL              string
	Difficulty       string
	EventType        string
	Rating           string
	ExtensionVersion string
	EventTime        time.Time
	IdempotencyKey   string
	RawPayload       []byte

	Solved bool
}

// IngestOutput is the result of persisting one event.
type IngestOutput struct {
	ProblemID    int64
	ReviewID     int64
	Duplicate    bool
	Status       string
	NextReviewAt *time.Time
}

// Repository persists extension events and the problem/progress/schedule they
// produce.
type Repository interface {
	PlatformIDByCode(ctx context.Context, code string) (int64, error)
	Ingest(ctx context.Context, in IngestInput) (IngestOutput, error)
}

type pgRepository struct {
	pool  *pgxpool.Pool
	q     *db.Queries
	sched scheduler.Scheduler
}

// NewRepository builds a Postgres-backed Repository. The scheduler is used
// inside upsertSchedule to compute the next-review decision with prior FSRS
// state, so that extension and review paths share one algorithm (issue #160).
func NewRepository(pool *pgxpool.Pool, sched scheduler.Scheduler) *pgRepository {
	return &pgRepository{pool: pool, q: db.New(pool), sched: sched}
}

func (r *pgRepository) PlatformIDByCode(ctx context.Context, code string) (int64, error) {
	platform, err := r.q.GetPlatformByCode(ctx, code)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrUnknownPlatform
	}
	if err != nil {
		return 0, fmt.Errorf("extension: lookup platform: %w", err)
	}
	return platform.ID, nil
}

// Ingest runs the whole save as one transaction: upsert the catalog problem,
// record the event idempotently, and (for a solved event that is not a replay)
// update progress and create/advance the review schedule.
func (r *pgRepository) Ingest(ctx context.Context, in IngestInput) (out IngestOutput, err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return IngestOutput{}, fmt.Errorf("extension: begin tx: %w", err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		if rollbackErr := tx.Rollback(ctx); rollbackErr != nil {
			err = errors.Join(err, fmt.Errorf("extension: rollback tx: %w", rollbackErr))
		}
	}()

	q := r.q.WithTx(tx)

	problemID, err := q.UpsertExtensionProblem(ctx, db.UpsertExtensionProblemParams{
		PlatformID:      in.PlatformID,
		ExternalSlug:    in.Slug,
		Title:           in.Title,
		Url:             in.URL,
		Difficulty:      optText(in.Difficulty),
		CreatedByUserID: toInt8(in.UserID),
	})
	if err != nil {
		return IngestOutput{}, fmt.Errorf("extension: upsert problem: %w", err)
	}
	out = IngestOutput{ProblemID: problemID}

	_, err = q.InsertExtensionEvent(ctx, db.InsertExtensionEventParams{
		UserID:           toInt8(in.UserID),
		PlatformID:       in.PlatformID,
		Url:              in.URL,
		ExternalSlug:     optText(in.Slug),
		Title:            optText(in.Title),
		EventType:        in.EventType,
		Rating:           optText(in.Rating),
		ExtensionVersion: optText(in.ExtensionVersion),
		EventTime:        toTimestamptz(in.EventTime),
		IdempotencyKey:   optText(in.IdempotencyKey),
		RawPayload:       in.RawPayload,
	})
	duplicate := errors.Is(err, pgx.ErrNoRows)
	if err != nil && !duplicate {
		return IngestOutput{}, fmt.Errorf("extension: insert event: %w", err)
	}

	// A replayed event must not advance the schedule; return current state.
	if duplicate {
		out.Duplicate = true
		sched, e := q.GetProblemReviewSchedule(ctx, db.GetProblemReviewScheduleParams{
			UserID: in.UserID, ProblemID: toInt8(problemID),
		})
		switch {
		case e == nil:
			out.Status = "reviewing"
			out.ReviewID = sched.ID
			out.NextReviewAt = timePtr(sched.NextReviewAt)
		case !errors.Is(e, pgx.ErrNoRows):
			slog.Error("extension: lookup review schedule failed", slog.String("layer", "repo"), slog.String("module", "extension"), slog.Any("err", e), slog.Int64("user_id", in.UserID), slog.Int64("problem_id", problemID))
		}
		if err := tx.Commit(ctx); err != nil {
			return IngestOutput{}, fmt.Errorf("extension: commit tx: %w", err)
		}
		committed = true
		return out, nil
	}

	// Non-solved events are recorded without touching progress/schedule.
	if !in.Solved {
		out.Status = "saved"
		if err := tx.Commit(ctx); err != nil {
			return IngestOutput{}, fmt.Errorf("extension: commit tx: %w", err)
		}
		committed = true
		return out, nil
	}

	if err := q.UpsertSolvedProgress(ctx, db.UpsertSolvedProgressParams{
		UserID:      in.UserID,
		ProblemID:   problemID,
		Rating:      optText(in.Rating),
		FirstSeenAt: toTimestamptz(in.EventTime),
	}); err != nil {
		return IngestOutput{}, fmt.Errorf("extension: upsert progress: %w", err)
	}

	reviewID, nextReviewAt, err := r.upsertSchedule(ctx, q, in, problemID)
	if err != nil {
		return IngestOutput{}, err
	}
	out.Status = "reviewing"
	out.ReviewID = reviewID
	out.NextReviewAt = &nextReviewAt

	if err := tx.Commit(ctx); err != nil {
		return IngestOutput{}, fmt.Errorf("extension: commit tx: %w", err)
	}
	committed = true
	return out, nil
}

// upsertSchedule creates the problem's schedule on first solve, otherwise
// advances the existing one using the scheduler. For new schedules the
// scheduler runs Next (no prior state); for existing ones it runs NextWithState
// so that FSRS history is preserved (issue #160).
func (r *pgRepository) upsertSchedule(ctx context.Context, q *db.Queries, in IngestInput, problemID int64) (int64, time.Time, error) {
	rating := scheduler.Rating(in.Rating)

	existing, err := q.GetProblemReviewSchedule(ctx, db.GetProblemReviewScheduleParams{
		UserID: in.UserID, ProblemID: toInt8(problemID),
	})
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		// First solve — use Next (no prior FSRS state).
		decision, derr := r.sched.Next(rating, in.EventTime)
		if derr != nil {
			return 0, time.Time{}, fmt.Errorf("extension: schedule decision: %w", derr)
		}
		row, cerr := q.CreateProblemReviewSchedule(ctx, db.CreateProblemReviewScheduleParams{
			UserID:         in.UserID,
			ProblemID:      toInt8(problemID),
			NextReviewAt:   toTimestamptz(decision.NextReviewAt),
			IntervalDays:   decision.IntervalDays,
			Ease:           decision.Ease,
			Stability:      decision.Stability,
			Difficulty:     decision.Difficulty,
			State:          int16(decision.State),
			Lapses:         int32(decision.Lapses),
			RemainingSteps: int32(decision.RemainingSteps),
			LastReviewAt:   toTimestamptz(in.EventTime),
			LastRating:     optText(in.Rating),
			Algorithm:      optText(algorithmFSRS),
		})
		if cerr != nil {
			return 0, time.Time{}, fmt.Errorf("extension: create schedule: %w", cerr)
		}
		return row.ID, row.NextReviewAt.Time, nil
	case err != nil:
		return 0, time.Time{}, fmt.Errorf("extension: lookup schedule: %w", err)
	default:
		// Re-solve — use NextWithState with existing FSRS history.
		prior := scheduler.SchedulerState{
			Stability:  existing.Stability,
			Difficulty: existing.Difficulty,
			Ease:       existing.Ease,
			State:      int8(existing.State),
			Lapses:     uint64(existing.Lapses),
			LastReview: existing.LastReviewAt.Time,
			Due:        existing.NextReviewAt.Time,
		}
		decision, derr := r.sched.NextWithState(prior, rating, in.EventTime)
		if derr != nil {
			return 0, time.Time{}, fmt.Errorf("extension: schedule decision: %w", derr)
		}
		row, uerr := q.AdvanceProblemReviewSchedule(ctx, db.AdvanceProblemReviewScheduleParams{
			ID:             existing.ID,
			NextReviewAt:   toTimestamptz(decision.NextReviewAt),
			IntervalDays:   decision.IntervalDays,
			Stability:      decision.Stability,
			Difficulty:     decision.Difficulty,
			State:          int16(decision.State),
			Lapses:         int32(decision.Lapses),
			RemainingSteps: int32(decision.RemainingSteps),
			LastReviewAt:   toTimestamptz(in.EventTime),
			LastRating:     optText(in.Rating),
		})
		if uerr != nil {
			return 0, time.Time{}, fmt.Errorf("extension: advance schedule: %w", uerr)
		}
		return row.ID, row.NextReviewAt.Time, nil
	}
}

// --- pgtype helpers ---------------------------------------------------------

func optText(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: s, Valid: true}
}

func toInt8(v int64) pgtype.Int8 {
	return pgtype.Int8{Int64: v, Valid: true}
}

func toTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

func timePtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time
	return &v
}
