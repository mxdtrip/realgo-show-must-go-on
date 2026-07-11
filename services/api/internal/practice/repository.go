package practice

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

var ErrSubpatternNotFound = errors.New("subpattern not found")

// Subpattern — элемент практики пользователя.
type Subpattern struct {
	Code    string    `json:"code"`
	Name    string    `json:"name"`
	AddedAt time.Time `json:"addedAt"`
}

type Repository struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool, q: db.New(pool)}
}

func (r *Repository) List(ctx context.Context, userID int64) ([]Subpattern, error) {
	rows, err := r.q.ListPracticeSubpatterns(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("practice: list: %w", err)
	}
	items := make([]Subpattern, 0, len(rows))
	for _, row := range rows {
		items = append(items, Subpattern{
			Code:    row.Code,
			Name:    row.Name,
			AddedAt: row.AddedAt.Time,
		})
	}
	return items, nil
}

// Add включает подпаттерн в практику (идемпотентно) и сразу ставит все его
// карточки в личную очередь повторения пользователя (review_schedules),
// чтобы практика подпаттерна не ждала первой оценки карточки по одной.
// ErrSubpatternNotFound, если такого кода нет или узел не является
// подпаттерном.
func (r *Repository) Add(ctx context.Context, userID int64, code string) (err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("practice: begin tx: %w", err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		if rollbackErr := tx.Rollback(ctx); rollbackErr != nil {
			err = errors.Join(err, fmt.Errorf("practice: rollback tx: %w", rollbackErr))
		}
	}()

	q := r.q.WithTx(tx)
	patternID, err := q.GetSubpatternIDByCode(ctx, code)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrSubpatternNotFound
	}
	if err != nil {
		return fmt.Errorf("practice: resolve subpattern: %w", err)
	}
	if err := q.AddPracticeSubpattern(ctx, db.AddPracticeSubpatternParams{
		UserID:    userID,
		PatternID: patternID,
	}); err != nil {
		return fmt.Errorf("practice: add: %w", err)
	}
	if err := q.EnqueueCardsForPatternIfAbsent(ctx, db.EnqueueCardsForPatternIfAbsentParams{
		UserID:    userID,
		PatternID: patternID,
	}); err != nil {
		return fmt.Errorf("practice: enqueue cards: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("practice: commit tx: %w", err)
	}
	committed = true
	return nil
}

// Remove выключает подпаттерн из практики (идемпотентно: отсутствие строки —
// не ошибка, чтобы двойной клик не превращался в 404).
func (r *Repository) Remove(ctx context.Context, userID int64, code string) error {
	if _, err := r.q.RemovePracticeSubpattern(ctx, db.RemovePracticeSubpatternParams{
		UserID: userID,
		Code:   code,
	}); err != nil {
		return fmt.Errorf("practice: remove: %w", err)
	}
	return nil
}
