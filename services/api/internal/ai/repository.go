package ai

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

type pgRepository struct{ q *db.Queries }

func NewRepository(pool *pgxpool.Pool) *pgRepository {
	return &pgRepository{q: db.New(pool)}
}

func (r *pgRepository) CreateAIRequestLog(ctx context.Context, userID int64, feature string) (int64, error) {
	row, err := r.q.CreateAIRequestLog(ctx, db.CreateAIRequestLogParams{
		UserID:  userID,
		Feature: pgtype.Text{String: feature, Valid: true},
	})
	if err != nil {
		return 0, err
	}
	return row.ID, nil
}
