package ai

import (
	"context"
	"errors"
	"fmt"

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

func (r *pgRepository) CreateAIRequestLog(ctx context.Context, userID int64, feature string) (int64, error) {
	row, err := r.q.CreateAIRequestLog(ctx, db.CreateAIRequestLogParams{
		UserID:  userID,
		Feature: pgtype.Text{String: feature, Valid: true},
	})
	if err != nil {
		return 0, fmt.Errorf("ai: create request log: %w", err)
	}
	return row.ID, nil
}

// CountGlobalCards reports how many global (user_id IS NULL) AI-generated
// cards already exist for a problem. Used by Provisioner to skip generation
// that already happened.
func (r *pgRepository) CountGlobalCards(ctx context.Context, problemID int64) (int64, error) {
	count, err := r.q.CountGlobalAICardsByProblem(ctx, problemID)
	if err != nil {
		return 0, fmt.Errorf("ai: count global ai cards: %w", err)
	}
	return count, nil
}

// ProblemInfo fetches the problem context fed into the generation prompt.
func (r *pgRepository) ProblemInfo(ctx context.Context, problemID int64) (ProblemInfo, error) {
	row, err := r.q.GetProblemForGeneration(ctx, problemID)
	if err != nil {
		return ProblemInfo{}, fmt.Errorf("ai: get problem for generation: %w", err)
	}
	return ProblemInfo{
		Title:      row.Title,
		URL:        row.Url,
		Difficulty: row.Difficulty,
		Platform:   row.Platform,
		Slug:       row.Slug,
	}, nil
}

// UpsertGeneratedCards idempotently inserts (or refreshes) a full batch of
// global AI-generated cards in one transaction, relying on
// cards_ai_global_unique_idx for dedup. The transaction matters: readers
// (GET /me/problems/{id}/cards) must never observe a partial batch as
// "ready" with fewer than the generated cards.
func (r *pgRepository) UpsertGeneratedCards(ctx context.Context, problemID int64, cards []GeneratedCard, promptVersion string) (err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("ai: begin tx: %w", err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		if rollbackErr := tx.Rollback(ctx); rollbackErr != nil {
			err = errors.Join(err, fmt.Errorf("ai: rollback tx: %w", rollbackErr))
		}
	}()

	q := r.q.WithTx(tx)
	for _, card := range cards {
		params := db.UpsertGeneratedCardParams{
			ProblemID:       problemID,
			CardType:        card.Type,
			Question:        card.Question,
			Answer:          card.Answer,
			AiPromptVersion: pgtype.Text{String: promptVersion, Valid: true},
		}
		if card.Explanation != "" {
			params.Explanation = pgtype.Text{String: card.Explanation, Valid: true}
		}
		if _, err := q.UpsertGeneratedCard(ctx, params); err != nil {
			return fmt.Errorf("ai: upsert generated card: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("ai: commit tx: %w", err)
	}
	committed = true
	return nil
}

// LogGenerationRequest records one CardProvisioner attempt in ai_request_logs
// for observability (status: success | failed | refused).
func (r *pgRepository) LogGenerationRequest(ctx context.Context, model, status string) error {
	if err := r.q.LogCardGenerationRequest(ctx, db.LogCardGenerationRequestParams{
		Provider: pgtype.Text{String: "ai_provisioner", Valid: true},
		Model:    pgtype.Text{String: model, Valid: true},
		Status:   pgtype.Text{String: status, Valid: true},
	}); err != nil {
		return fmt.Errorf("ai: log generation request: %w", err)
	}
	return nil
}
