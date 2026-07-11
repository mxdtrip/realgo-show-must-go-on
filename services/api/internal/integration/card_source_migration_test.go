//go:build integration

package integration

import (
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"

	"github.com/mxdtrip/freeburger/services/api/migrations"
)

func TestCardSourceMigrationRepairsDuplicatesAndPreservesOldestReferences(t *testing.T) {
	h := newContractHarness(t)
	tx, err := h.pg.Pool.Begin(h.ctx)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, tx.Rollback(h.ctx)) })

	// Recreate the schema immediately before migration 000017, then inject the
	// historical duplicate shape that production may contain.
	applyMigrationFile(t, tx, "000017_card_source_identity.down.sql")

	var userID, problemID int64
	require.NoError(t, tx.QueryRow(h.ctx, `
		INSERT INTO users (email, password_hash)
		VALUES ('migration-225@example.test', 'not-used')
		RETURNING id
	`).Scan(&userID))
	require.NoError(t, tx.QueryRow(h.ctx, `
		INSERT INTO problems (platform_id, external_slug, title, url, difficulty)
		SELECT id, 'migration-225', 'Migration 225', 'https://example.test/migration-225', 'easy'
		FROM platforms WHERE code = 'generic'
		RETURNING id
	`).Scan(&problemID))

	var oldestID, duplicateID int64
	require.NoError(t, tx.QueryRow(h.ctx, `
		INSERT INTO cards (problem_id, type, question, answer, source, created_by_ai)
		VALUES ($1, 'pattern_recognition', 'oldest', 'answer', 'migration-225:same', false)
		RETURNING id
	`, problemID).Scan(&oldestID))
	require.NoError(t, tx.QueryRow(h.ctx, `
		INSERT INTO cards (problem_id, type, question, answer, source, created_by_ai)
		VALUES ($1, 'pattern_recognition', 'duplicate', 'answer', 'migration-225:same', false)
		RETURNING id
	`, problemID).Scan(&duplicateID))
	require.Greater(t, duplicateID, oldestID)

	_, err = tx.Exec(h.ctx, `
		INSERT INTO review_schedules (user_id, card_id, next_review_at, interval_days, ease, stability, difficulty)
		VALUES ($1, $2, now(), 3, 2.5, 1, 5)
	`, userID, oldestID)
	require.NoError(t, err)
	_, err = tx.Exec(h.ctx, `
		INSERT INTO review_attempts (user_id, card_id, rating, review_type)
		VALUES ($1, $2, 'normal', 'card')
	`, userID, oldestID)
	require.NoError(t, err)

	applyMigrationFile(t, tx, "000017_card_source_identity.up.sql")

	var remainingID int64
	require.NoError(t, tx.QueryRow(h.ctx, `
		SELECT id FROM cards
		WHERE user_id IS NULL AND source = 'migration-225:same'
	`).Scan(&remainingID))
	require.Equal(t, oldestID, remainingID)

	var schedules, attempts int
	require.NoError(t, tx.QueryRow(h.ctx, `SELECT COUNT(*) FROM review_schedules WHERE card_id = $1`, oldestID).Scan(&schedules))
	require.NoError(t, tx.QueryRow(h.ctx, `SELECT COUNT(*) FROM review_attempts WHERE card_id = $1`, oldestID).Scan(&attempts))
	require.Equal(t, 1, schedules)
	require.Equal(t, 1, attempts)

	// The partial index rejects another global duplicate without preventing a
	// user-owned card from using the same source value.
	duplicateInsert, err := tx.Begin(h.ctx)
	require.NoError(t, err)
	_, err = duplicateInsert.Exec(h.ctx, `
		INSERT INTO cards (problem_id, type, question, answer, source, created_by_ai)
		VALUES ($1, 'edge_case', 'global duplicate', 'answer', 'migration-225:same', false)
	`, problemID)
	require.Error(t, err)
	require.ErrorContains(t, err, "cards_source_global_unique_idx")
	require.NoError(t, duplicateInsert.Rollback(h.ctx))

	_, err = tx.Exec(h.ctx, `
		INSERT INTO cards (user_id, problem_id, type, question, answer, source, created_by_ai)
		VALUES ($1, $2, 'edge_case', 'user card', 'answer', 'migration-225:same', false)
	`, userID, problemID)
	require.NoError(t, err)
	_, err = tx.Exec(h.ctx, `
		INSERT INTO cards (problem_id, type, question, answer, source, created_by_ai)
		VALUES ($1, 'pattern_recognition', 'second legitimate card', 'answer', 'migration-225:other', false)
	`, problemID)
	require.NoError(t, err)
}

func applyMigrationFile(t *testing.T, tx pgx.Tx, name string) {
	t.Helper()
	raw, err := migrations.FS.ReadFile(name)
	require.NoError(t, err)

	sql := strings.TrimSpace(string(raw))
	sql = strings.TrimSpace(strings.TrimPrefix(sql, "BEGIN;"))
	sql = strings.TrimSpace(strings.TrimSuffix(sql, "COMMIT;"))
	_, err = tx.Exec(t.Context(), sql)
	require.NoError(t, err)
}
