package extension

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

// StatusRepository reads extension connection status from persisted events.
type StatusRepository interface {
	ListPlatformStatuses(ctx context.Context, userID int64) ([]PlatformStatus, error)
	ListRecentEvents(ctx context.Context, userID int64, limit int32) ([]RecentEvent, error)
}

type pgStatusRepository struct {
	q *db.Queries
}

// NewStatusRepository builds a Postgres-backed status repository.
func NewStatusRepository(pool *pgxpool.Pool) *pgStatusRepository {
	return &pgStatusRepository{q: db.New(pool)}
}

func (r *pgStatusRepository) ListPlatformStatuses(ctx context.Context, userID int64) ([]PlatformStatus, error) {
	rows, err := r.q.ListExtensionPlatformStatuses(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("extension status: list platform statuses: %w", err)
	}

	out := make([]PlatformStatus, 0, len(rows))
	for _, row := range rows {
		lastSyncAt, ok := validTime(row.LastSyncAt)
		if !ok {
			continue
		}
		out = append(out, PlatformStatus{
			Source:     row.Source,
			Status:     row.Status,
			LastSyncAt: lastSyncAt,
		})
	}
	return out, nil
}

func (r *pgStatusRepository) ListRecentEvents(ctx context.Context, userID int64, limit int32) ([]RecentEvent, error) {
	rows, err := r.q.ListExtensionRecentEvents(ctx, db.ListExtensionRecentEventsParams{
		UserID:     userID,
		EventLimit: limit,
	})
	if err != nil {
		return nil, fmt.Errorf("extension status: list recent events: %w", err)
	}

	out := make([]RecentEvent, 0, len(rows))
	for _, row := range rows {
		occurredAt, ok := validTime(row.OccurredAt)
		if !ok {
			continue
		}
		out = append(out, RecentEvent{
			ID:         row.EventID,
			Source:     row.Source,
			Event:      row.Event,
			Title:      row.Title,
			OccurredAt: occurredAt,
		})
	}
	return out, nil
}

func validTime(value pgtype.Timestamptz) (time.Time, bool) {
	if !value.Valid {
		return time.Time{}, false
	}
	return value.Time.UTC(), true
}
