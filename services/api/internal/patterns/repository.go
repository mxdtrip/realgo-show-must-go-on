package patterns

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

type pgRepository struct {
	q *db.Queries
}

func NewRepository(pool *pgxpool.Pool) *pgRepository {
	return &pgRepository{q: db.New(pool)}
}

func (r *pgRepository) ListWeak(ctx context.Context, userID int64, limit int32) ([]WeakPattern, error) {
	rows, err := r.q.ListWeakPatterns(ctx, db.ListWeakPatternsParams{UserID: userID, Limit: limit})
	if err != nil {
		return nil, fmt.Errorf("patterns: list weak: %w", err)
	}

	items := make([]WeakPattern, 0, len(rows))
	for _, row := range rows {
		items = append(items, WeakPattern{
			PatternCode:   row.PatternCode,
			Pattern:       row.PatternName,
			HardCount:     int(row.HardCount),
			ReviewCount:   int(row.ReviewCount),
			LowConfidence: row.HardCount > 0,
		})
	}
	return items, nil
}
