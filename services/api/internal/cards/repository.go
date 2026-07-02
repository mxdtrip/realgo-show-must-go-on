package cards

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

func NewRepository(pool *pgxpool.Pool) *pgRepository {
	return &pgRepository{pool: pool, q: db.New(pool)}
}

func (r *pgRepository) List(ctx context.Context, userID int64, params ListParams) ([]CardRecord, error) {
	rows, err := r.q.ListUserCards(ctx, db.ListUserCardsParams{
		UserID:          userID,
		CardType:        params.Type,
		CursorCreatedAt: toTimestamptz(params.Cursor.CreatedAt),
		CursorID:        params.Cursor.ID,
		LimitRows:       params.Limit,
	})
	if err != nil {
		return nil, fmt.Errorf("cards: list user cards: %w", err)
	}

	items := make([]CardRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, recordFromListRow(row))
	}
	return items, nil
}

func (r *pgRepository) ListSession(ctx context.Context, userID int64, params SessionParams) ([]CardRecord, error) {
	rows, err := r.q.ListCardSession(ctx, db.ListCardSessionParams{
		UserID:    userID,
		Scope:     params.Scope,
		CardLimit: params.Limit,
	})
	if err != nil {
		return nil, fmt.Errorf("cards: list session: %w", err)
	}

	items := make([]CardRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, recordFromSessionRow(row))
	}
	return items, nil
}

func (r *pgRepository) EnsureReviewSchedule(ctx context.Context, userID, cardID int64, reviewedAt time.Time) (int64, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("cards: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	q := r.q.WithTx(tx)
	id, err := q.GetCardReviewSchedule(ctx, db.GetCardReviewScheduleParams{UserID: userID, CardID: toInt8(cardID)})
	switch {
	case err == nil:
		if err := tx.Commit(ctx); err != nil {
			return 0, fmt.Errorf("cards: commit tx: %w", err)
		}
		return id, nil
	case errors.Is(err, pgx.ErrNoRows):
		if _, err := q.GetAccessibleCard(ctx, db.GetAccessibleCardParams{CardID: cardID, UserID: userID}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return 0, ErrCardNotFound
			}
			return 0, fmt.Errorf("cards: lookup card: %w", err)
		}
		createdID, err := q.CreateCardReviewSchedule(ctx, db.CreateCardReviewScheduleParams{
			UserID:       userID,
			CardID:       toInt8(cardID),
			NextReviewAt: toTimestamptz(reviewedAt),
		})
		if err != nil {
			return 0, fmt.Errorf("cards: create schedule: %w", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return 0, fmt.Errorf("cards: commit tx: %w", err)
		}
		return createdID, nil
	default:
		return 0, fmt.Errorf("cards: lookup schedule: %w", err)
	}
}

func (r *pgRepository) CountSessionAttempts(ctx context.Context, userID int64, since time.Time) (int, error) {
	count, err := r.q.CountCardSessionAttempts(ctx, db.CountCardSessionAttemptsParams{
		UserID:    userID,
		CreatedAt: toTimestamptz(since),
	})
	if err != nil {
		return 0, fmt.Errorf("cards: count session attempts: %w", err)
	}
	return int(count), nil
}

func recordFromListRow(row db.ListUserCardsRow) CardRecord {
	return CardRecord{
		ID:               row.ID,
		Type:             row.Type,
		Question:         row.Question,
		Answer:           row.Answer,
		CreatedAt:        timeFromPg(row.CreatedAt),
		SourceEntityType: row.SourceEntityType,
		SourceEntityID:   int64PtrFromPg(row.SourceEntityID),
		SourceLabel:      row.SourceLabel,
		ScheduleID:       scheduleIDPtr(row.ScheduleID),
		NextReviewAt:     timePtrFromPg(row.NextReviewAt),
		LastRating:       stringPtrFromPg(row.LastRating),
		ReviewCount:      int(row.ReviewCount),
		ReviewState:      int(row.ReviewState),
	}
}

func recordFromSessionRow(row db.ListCardSessionRow) CardRecord {
	return CardRecord{
		ID:               row.ID,
		Type:             row.Type,
		Question:         row.Question,
		Answer:           row.Answer,
		CreatedAt:        timeFromPg(row.CreatedAt),
		SourceEntityType: row.SourceEntityType,
		SourceEntityID:   int64PtrFromPg(row.SourceEntityID),
		SourceLabel:      row.SourceLabel,
		ScheduleID:       scheduleIDPtr(row.ScheduleID),
		NextReviewAt:     timePtrFromPg(row.NextReviewAt),
		LastRating:       stringPtrFromPg(row.LastRating),
		ReviewCount:      int(row.ReviewCount),
		ReviewState:      int(row.ReviewState),
	}
}

func int64PtrFromPg(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}

func scheduleIDPtr(value int64) *int64 {
	if value == 0 {
		return nil
	}
	return &value
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
	v := value.Time.UTC()
	return &v
}

func timeFromPg(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Unix(0, 0).UTC()
	}
	return value.Time.UTC()
}

func toInt8(value int64) pgtype.Int8 {
	return pgtype.Int8{Int64: value, Valid: true}
}

func toTimestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value.UTC(), Valid: true}
}
