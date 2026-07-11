//go:build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestContractPracticeAddEnqueuesSubpatternCards covers the practice-add ->
// review-cycle wiring: adding a subpattern to practice must immediately put
// that subpattern's global cards into the user's review_schedules, instead
// of waiting for a lazy schedule row created by the first individual card
// rating. Removing the subpattern from practice must not touch existing
// review history (mirrors the problems precedent: no "unpractice" action
// deletes review_schedules).
func TestContractPracticeAddEnqueuesSubpatternCards(t *testing.T) {
	h := newContractHarness(t)
	suffix := uniqueSuffix("practice-enqueue")
	email := uniqueEmail("practice-enqueue")

	tokens := h.register(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokens.refresh) })

	subpatternCode := "frequency_counting"
	patternID := h.getPatternIDByCode(t, subpatternCode)
	cardIDs := []int64{
		h.insertPatternCard(t, patternID, "pattern_recognition", "Enqueue test recognition "+suffix),
		h.insertPatternCard(t, patternID, "algorithm_mechanics", "Enqueue test mechanics "+suffix),
		h.insertPatternCard(t, patternID, "edge_case", "Enqueue test edge "+suffix),
	}
	t.Cleanup(func() {
		h.cleanupUser(email)
		_, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM cards WHERE id = ANY($1)`, cardIDs)
	})

	t.Run("Add enqueues all three cards immediately", func(t *testing.T) {
		resp := h.request(t, http.MethodPost, "/api/v1/me/practice/subpatterns", tokens.access,
			map[string]string{"code": subpatternCode})
		data := requireSuccessEnvelope(t, resp, http.StatusOK)
		require.Equal(t, subpatternCode, data["code"])
		require.Equal(t, true, data["active"])

		scheduled := h.countReviewSchedulesForCards(t, tokens.userID, cardIDs)
		require.Equal(t, 3, scheduled, "expected a review_schedules row for each of the subpattern's cards")
	})

	t.Run("Add again does not duplicate schedules", func(t *testing.T) {
		resp := h.request(t, http.MethodPost, "/api/v1/me/practice/subpatterns", tokens.access,
			map[string]string{"code": subpatternCode})
		requireSuccessEnvelope(t, resp, http.StatusOK)

		scheduled := h.countReviewSchedulesForCards(t, tokens.userID, cardIDs)
		require.Equal(t, 3, scheduled, "re-adding the same subpattern must stay idempotent")
	})

	t.Run("Remove keeps review history intact", func(t *testing.T) {
		resp := h.request(t, http.MethodDelete, "/api/v1/me/practice/subpatterns/"+subpatternCode, tokens.access, nil)
		require.Equal(t, http.StatusNoContent, resp.status, resp.raw)

		scheduled := h.countReviewSchedulesForCards(t, tokens.userID, cardIDs)
		require.Equal(t, 3, scheduled, "removing from practice must not delete review_schedules")
	})

	t.Run("unknown subpattern code is rejected", func(t *testing.T) {
		resp := h.request(t, http.MethodPost, "/api/v1/me/practice/subpatterns", tokens.access,
			map[string]string{"code": "not-a-real-subpattern-" + suffix})
		requireErrorEnvelope(t, resp, http.StatusNotFound, "NOT_FOUND")
	})
}

func (h *contractHarness) getPatternIDByCode(t *testing.T, code string) int64 {
	t.Helper()

	var id int64
	err := h.pg.Pool.QueryRow(h.ctx, `
		SELECT id FROM patterns WHERE code = $1 AND kind = 'subpattern'
	`, code).Scan(&id)
	require.NoError(t, err, "subpattern %q must exist (migrations/000015_taxonomy_v2)", code)
	return id
}

func (h *contractHarness) insertPatternCard(t *testing.T, patternID int64, cardType, question string) int64 {
	t.Helper()

	var id int64
	err := h.pg.Pool.QueryRow(h.ctx, `
		INSERT INTO cards (pattern_id, type, question, answer, created_by_ai)
		VALUES ($1, $2, $3, 'answer', FALSE)
		RETURNING id
	`, patternID, cardType, question).Scan(&id)
	require.NoError(t, err)
	return id
}

func (h *contractHarness) countReviewSchedulesForCards(t *testing.T, userID int64, cardIDs []int64) int {
	t.Helper()

	var count int
	err := h.pg.Pool.QueryRow(h.ctx, `
		SELECT COUNT(*) FROM review_schedules
		WHERE user_id = $1 AND card_id = ANY($2)
	`, userID, cardIDs).Scan(&count)
	require.NoError(t, err)
	return count
}
