package dashboard

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

type pgRepository struct {
	q *db.Queries
}

func NewRepository(pool *pgxpool.Pool) *pgRepository {
	return &pgRepository{q: db.New(pool)}
}

func (r *pgRepository) GetMetrics(ctx context.Context, userID int64) (Metrics, error) {
	row, err := r.q.GetDashboardMetrics(ctx, userID)
	if err != nil {
		return Metrics{}, fmt.Errorf("dashboard: query metrics: %w", err)
	}
	return Metrics{
		DueCount:        int(row.DueCount),
		DueProblemCount: int(row.DueProblemCount),
		DueCardCount:    int(row.DueCardCount),
		DuePatternCount: int(row.DuePatternCount),
		SolvedCount:     int(row.SolvedCount),
		ProgressCount:   int(row.ProgressCount),
		Readiness:       int(row.Readiness),
		CurrentStreak:   int(row.CurrentStreak),
	}, nil
}

func (r *pgRepository) ListReviewPreview(ctx context.Context, userID int64, limit int32) ([]ReviewPreview, error) {
	rows, err := r.q.ListDashboardReviewPreview(ctx, db.ListDashboardReviewPreviewParams{UserID: userID, Limit: limit})
	if err != nil {
		return nil, fmt.Errorf("dashboard: query review preview: %w", err)
	}

	items := make([]ReviewPreview, 0, len(rows))
	for _, row := range rows {
		items = append(items, ReviewPreview{
			ID:          row.ID,
			EntityType:  row.EntityType,
			Title:       row.Title,
			PatternName: row.PatternName,
			Difficulty:  row.Difficulty,
			DueAt:       row.NextReviewAt.Time,
			LastRating:  textPtr(row.LastRating),
			Attempts:    int(row.ReviewCount),
		})
	}
	return items, nil
}

func (r *pgRepository) GetNextReview(ctx context.Context, userID int64) (*ReviewPreview, error) {
	row, err := r.q.GetDashboardNextReview(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("dashboard: query next review: %w", err)
	}
	return &ReviewPreview{
		ID:          row.ID,
		EntityType:  row.EntityType,
		Title:       row.Title,
		PatternName: row.PatternName,
		Difficulty:  row.Difficulty,
		DueAt:       row.NextReviewAt.Time,
		LastRating:  textPtr(row.LastRating),
		Attempts:    int(row.ReviewCount),
	}, nil
}

func textPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}
