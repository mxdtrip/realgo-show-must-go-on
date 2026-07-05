package problemcards

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

type pgRepository struct{ q *db.Queries }

func NewRepository(pool *pgxpool.Pool) *pgRepository {
	return &pgRepository{q: db.New(pool)}
}

// LockKeyParts returns the platform code + external slug used to build the
// CardProvisioner lock key. ErrProblemNotFound if problemID does not exist.
func (r *pgRepository) LockKeyParts(ctx context.Context, problemID int64) (platform, slug string, err error) {
	row, err := r.q.GetProblemLockKeyParts(ctx, problemID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrProblemNotFound
	}
	if err != nil {
		return "", "", fmt.Errorf("problemcards: lookup problem: %w", err)
	}
	return row.Platform, row.Slug, nil
}
