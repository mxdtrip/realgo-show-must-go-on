package roadmaps

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

func (r *pgRepository) List(ctx context.Context, code string) ([]Item, error) {
	rows, err := r.q.ListRoadmapItems(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("roadmaps: list items: %w", err)
	}

	items := make([]Item, 0, len(rows))
	for _, row := range rows {
		items = append(items, Item{
			Position:    int(row.Position),
			PatternCode: row.PatternCode,
			Pattern:     row.PatternName,
			ProblemID:   row.ProblemID,
			ExternalID:  row.ExternalID.String,
			Slug:        row.ExternalSlug,
			Title:       row.Title,
			URL:         row.Url,
			Difficulty:  row.Difficulty.String,
		})
	}
	return items, nil
}
