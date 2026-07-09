//go:build integration

package integration

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestContractCardsVisibility_AIGlobalCardsGatedByProgress covers the audit
// finding: GET /me/cards and GET /me/cards/session used to return every
// global card (user_id IS NULL) to every user, so an AI-generated card for a
// problem solved by one user showed up in every other user's cabinet. A
// global card tied to a problem (problem_id IS NOT NULL) must now stay
// hidden from a user until that user has progress (solved/reviewing) on the
// underlying problem, unless it's a seed card (created_by_ai = false), which
// stays visible to everyone as before.
func TestContractCardsVisibility_AIGlobalCardsGatedByProgress(t *testing.T) {
	h := newContractHarness(t)
	suffix := uniqueSuffix("cards-visibility")
	slug := "cards-vis-" + suffix

	emailA := uniqueEmail("cards-vis-a")
	emailB := uniqueEmail("cards-vis-b")
	tokensA := h.register(t, emailA, "Password123!")
	tokensB := h.register(t, emailB, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokensA.refresh, tokensB.refresh) })

	problemID := h.insertProblem(t, slug, "Cards Visibility "+suffix)
	aiCardID := h.insertProblemCard(t, problemID, "AI card "+suffix, true)
	seedCardID := h.insertProblemCard(t, problemID, "Seed card "+suffix, false)
	t.Cleanup(func() {
		h.cleanupUser(emailA)
		h.cleanupUser(emailB)
		_, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM cards WHERE id IN ($1, $2)`, aiCardID, seedCardID)
		_, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM problems WHERE id = $1`, problemID)
	})

	// User A solved the problem; user B has no progress on it at all.
	h.insertProblemProgress(t, tokensA.userID, problemID, "reviewing")

	t.Run("GET /me/cards", func(t *testing.T) {
		listA := requireQueueEnvelope(t, h.request(t, http.MethodGet, "/api/v1/me/cards?limit=100", tokensA.access, nil), http.StatusOK)
		listB := requireQueueEnvelope(t, h.request(t, http.MethodGet, "/api/v1/me/cards?limit=100", tokensB.access, nil), http.StatusOK)

		require.True(t, containsCardID(listA, aiCardID), "user A (solved) must see the AI card")
		require.True(t, containsCardID(listA, seedCardID), "user A must see the seed card")
		require.False(t, containsCardID(listB, aiCardID), "user B (has not solved) must not see the AI card")
		require.True(t, containsCardID(listB, seedCardID), "user B must still see the seed card (demo unaffected)")
	})

	t.Run("direct rate cannot bypass hidden AI card visibility", func(t *testing.T) {
		resp := h.request(
			t,
			http.MethodPost,
			"/api/v1/me/cards/"+strconv.FormatInt(aiCardID, 10)+"/rate",
			tokensB.access,
			map[string]string{
				"rating":     "normal",
				"reviewedAt": "2026-07-07T10:00:00Z",
			},
		)
		requireErrorEnvelope(t, resp, http.StatusNotFound, "NOT_FOUND")
	})

	t.Run("GET /me/cards/session", func(t *testing.T) {
		sessionA := requireSuccessEnvelope(t, h.request(t, http.MethodGet, "/api/v1/me/cards/session?scope=all&limit=100", tokensA.access, nil), http.StatusOK)
		sessionB := requireSuccessEnvelope(t, h.request(t, http.MethodGet, "/api/v1/me/cards/session?scope=all&limit=100", tokensB.access, nil), http.StatusOK)

		cardsA, ok := sessionA["cards"].([]any)
		require.True(t, ok, "expected cards array in session response, got %T", sessionA["cards"])
		cardsB, ok := sessionB["cards"].([]any)
		require.True(t, ok, "expected cards array in session response, got %T", sessionB["cards"])

		require.True(t, containsCardID(cardsA, aiCardID), "user A (solved) must see the AI card in the session")
		require.True(t, containsCardID(cardsA, seedCardID), "user A must see the seed card in the session")
		require.False(t, containsCardID(cardsB, aiCardID), "user B (has not solved) must not see the AI card in the session")
		require.True(t, containsCardID(cardsB, seedCardID), "user B must still see the seed card in the session (demo unaffected)")
	})

	t.Run("solving the problem unlocks the AI card", func(t *testing.T) {
		h.insertProblemProgress(t, tokensB.userID, problemID, "reviewing")
		listB := requireQueueEnvelope(t, h.request(t, http.MethodGet, "/api/v1/me/cards?limit=100", tokensB.access, nil), http.StatusOK)
		require.True(t, containsCardID(listB, aiCardID), "user B must see the AI card once they've solved the problem too")
	})
}

func containsCardID(items []any, cardID int64) bool {
	for _, raw := range items {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		id, ok := item["id"].(float64)
		if !ok {
			continue
		}
		if int64(id) == cardID {
			return true
		}
	}
	return false
}

func (h *contractHarness) insertProblemCard(t *testing.T, problemID int64, question string, createdByAI bool) int64 {
	t.Helper()

	var id int64
	err := h.pg.Pool.QueryRow(h.ctx, `
		INSERT INTO cards (problem_id, type, question, answer, created_by_ai)
		VALUES ($1, 'algorithm_mechanics', $2, 'answer', $3)
		RETURNING id
	`, problemID, question, createdByAI).Scan(&id)
	require.NoError(t, err)
	return id
}

func (h *contractHarness) insertProblemProgress(t *testing.T, userID, problemID int64, status string) {
	t.Helper()

	_, err := h.pg.Pool.Exec(h.ctx, `
		INSERT INTO user_problem_progress (user_id, problem_id, status, first_seen_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (user_id, problem_id) DO UPDATE SET status = EXCLUDED.status
	`, userID, problemID, status)
	require.NoError(t, err)
}
