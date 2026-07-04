//go:build integration

package integration

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// reviewTarget picks exactly one of problem/pattern/card, mirroring the
// review_schedules exactly_one_review_target_check constraint.
type reviewTarget struct {
	problemID *int64
	patternID *int64
	cardID    *int64
}

func TestContractReviewQueuePagination(t *testing.T) {
	h := newContractHarness(t)
	suffix := uniqueSuffix("queue-pagination")
	email := "contract-" + suffix + "@example.test"
	slugA := "queue-pg-a-" + suffix
	slugB := "queue-pg-b-" + suffix

	tokens := h.register(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokens.refresh) })

	problemA := h.insertProblem(t, slugA, "Queue Pagination A")
	problemB := h.insertProblem(t, slugB, "Queue Pagination B")
	patternTwoPointers := h.patternID(t, "two_pointers")
	patternSlidingWindow := h.patternID(t, "sliding_window")
	cardID := h.insertCard(t, patternTwoPointers, "Queue pagination card "+suffix)

	t.Cleanup(func() {
		h.cleanupUser(email)
		_, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM cards WHERE id = $1`, cardID)
		_, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM problems WHERE external_slug IN ($1, $2)`, slugA, slugB)
	})

	base := time.Now().UTC().Add(-time.Hour)

	// idA and idB share the same next_review_at to exercise the (next_review_at, id) tiebreaker.
	idA := h.insertReviewSchedule(t, tokens.userID, reviewTarget{problemID: &problemA}, base)
	idB := h.insertReviewSchedule(t, tokens.userID, reviewTarget{patternID: &patternTwoPointers}, base)
	idC := h.insertReviewSchedule(t, tokens.userID, reviewTarget{cardID: &cardID}, base.Add(time.Second))
	idD := h.insertReviewSchedule(t, tokens.userID, reviewTarget{problemID: &problemB}, base.Add(2*time.Second))
	idE := h.insertReviewSchedule(t, tokens.userID, reviewTarget{patternID: &patternSlidingWindow}, base.Add(3*time.Second))

	page1 := h.request(t, http.MethodGet, "/api/v1/me/reviews/queue?status=due&limit=2", tokens.access, nil)
	page1Items := requireQueueEnvelope(t, page1, http.StatusOK)
	requireItemIDsInOrder(t, page1Items, idA, idB)
	require.Equal(t, "problem", stringField(t, itemAt(t, page1Items, 0), "entityType"))
	require.Equal(t, "pattern", stringField(t, itemAt(t, page1Items, 1), "entityType"))
	cursor1 := requireNextCursor(t, page1)

	page2 := h.request(t, http.MethodGet, "/api/v1/me/reviews/queue?status=due&limit=2&cursor="+*cursor1, tokens.access, nil)
	page2Items := requireQueueEnvelope(t, page2, http.StatusOK)
	requireItemIDsInOrder(t, page2Items, idC, idD)
	require.Equal(t, "card", stringField(t, itemAt(t, page2Items, 0), "entityType"))
	require.Equal(t, "problem", stringField(t, itemAt(t, page2Items, 1), "entityType"))
	cursor2 := requireNextCursor(t, page2)

	page3 := h.request(t, http.MethodGet, "/api/v1/me/reviews/queue?status=due&limit=2&cursor="+*cursor2, tokens.access, nil)
	page3Items := requireQueueEnvelope(t, page3, http.StatusOK)
	requireItemIDsInOrder(t, page3Items, idE)
	require.Equal(t, "pattern", stringField(t, itemAt(t, page3Items, 0), "entityType"))
	requireNilNextCursor(t, page3)
}

func TestContractReviewQueueLastPageWithoutCursorReturnsAllDueItems(t *testing.T) {
	h := newContractHarness(t)
	suffix := uniqueSuffix("queue-last-page")
	email := "contract-" + suffix + "@example.test"
	slug := "queue-last-page-" + suffix

	tokens := h.register(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokens.refresh) })

	problemID := h.insertProblem(t, slug, "Queue Last Page")
	t.Cleanup(func() {
		h.cleanupUser(email)
		_, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM problems WHERE external_slug = $1`, slug)
	})

	id := h.insertReviewSchedule(t, tokens.userID, reviewTarget{problemID: &problemID}, time.Now().UTC().Add(-time.Hour))

	resp := h.request(t, http.MethodGet, "/api/v1/me/reviews/queue?status=due&limit=50", tokens.access, nil)
	items := requireQueueEnvelope(t, resp, http.StatusOK)
	requireItemIDsInOrder(t, items, id)
	requireNilNextCursor(t, resp)
}

func TestContractReviewQueueInvalidCursorReturnsValidationError(t *testing.T) {
	h := newContractHarness(t)
	email := uniqueEmail("queue-invalid-cursor")
	t.Cleanup(func() { h.cleanupUser(email) })
	tokens := h.register(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokens.refresh) })

	resp := h.request(t, http.MethodGet, "/api/v1/me/reviews/queue?cursor=not-a-valid-cursor", tokens.access, nil)
	requireErrorEnvelope(t, resp, http.StatusBadRequest, "VALIDATION_ERROR")
}

func (h *contractHarness) insertProblem(t *testing.T, slug, title string) int64 {
	t.Helper()

	var id int64
	err := h.pg.Pool.QueryRow(h.ctx, `
		INSERT INTO problems (platform_id, external_slug, title, url, difficulty, source_type)
		SELECT id, $1, $2, $3, 'easy', 'manual' FROM platforms WHERE code = 'leetcode'
		RETURNING id
	`, slug, title, "https://leetcode.com/problems/"+slug+"/").Scan(&id)
	require.NoError(t, err)
	return id
}

func (h *contractHarness) patternID(t *testing.T, code string) int64 {
	t.Helper()

	var id int64
	err := h.pg.Pool.QueryRow(h.ctx, `SELECT id FROM patterns WHERE code = $1`, code).Scan(&id)
	require.NoError(t, err)
	return id
}

func (h *contractHarness) insertCard(t *testing.T, patternID int64, question string) int64 {
	t.Helper()

	var id int64
	err := h.pg.Pool.QueryRow(h.ctx, `
		INSERT INTO cards (pattern_id, type, question, answer)
		VALUES ($1, 'pattern_recognition', $2, 'answer')
		RETURNING id
	`, patternID, question).Scan(&id)
	require.NoError(t, err)
	return id
}

func (h *contractHarness) insertReviewSchedule(t *testing.T, userID int64, target reviewTarget, nextReviewAt time.Time) int64 {
	t.Helper()

	var id int64
	err := h.pg.Pool.QueryRow(h.ctx, `
		INSERT INTO review_schedules (user_id, problem_id, pattern_id, card_id, next_review_at, interval_days, ease, stability, difficulty, review_count, algorithm, state)
		VALUES ($1, $2, $3, $4, $5, 1, 2.5, 1.0, 5.0, 0, 'fsrs', 0)
		RETURNING id
	`, userID, target.problemID, target.patternID, target.cardID, nextReviewAt).Scan(&id)
	require.NoError(t, err)
	return id
}

func itemAt(t *testing.T, items []any, index int) map[string]any {
	t.Helper()

	item, ok := items[index].(map[string]any)
	require.True(t, ok, "expected queue item object at index %d, got %T", index, items[index])
	return item
}

func requireItemIDsInOrder(t *testing.T, items []any, ids ...int64) {
	t.Helper()

	require.Len(t, items, len(ids), "%+v", items)
	for i, id := range ids {
		require.Equal(t, id, int64Field(t, itemAt(t, items, i), "id"), "unexpected id at position %d", i)
	}
}

func requireNextCursor(t *testing.T, resp contractResponse) *string {
	t.Helper()

	meta := objectField(t, resp.body, "meta")
	cursor, ok := meta["nextCursor"].(string)
	require.True(t, ok, "expected nextCursor string, got %T: %s", meta["nextCursor"], resp.raw)
	require.NotEmpty(t, cursor)
	return &cursor
}

func requireNilNextCursor(t *testing.T, resp contractResponse) {
	t.Helper()

	meta := objectField(t, resp.body, "meta")
	require.Nil(t, meta["nextCursor"], "expected nextCursor to be null on the last page: %s", resp.raw)
}
