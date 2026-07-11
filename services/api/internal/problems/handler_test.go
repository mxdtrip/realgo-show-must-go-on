package problems

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

func TestListRequiresAuth(t *testing.T) {
	h := NewHandler(&fakeRepository{})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me/problems", nil)
	w := httptest.NewRecorder()

	h.List(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestListRejectsInvalidFilters(t *testing.T) {
	tests := []string{
		"/api/v1/me/problems?status=due",
		"/api/v1/me/problems?platform=topcoder",
		"/api/v1/me/problems?limit=zero",
		"/api/v1/me/problems?limit=0",
	}

	for _, target := range tests {
		h := NewHandler(&fakeRepository{})
		req := authenticatedRequest(target, 42)
		w := httptest.NewRecorder()

		h.List(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("%s: expected 400, got %d", target, w.Code)
		}
		var body struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("%s: invalid json: %v", target, err)
		}
		if body.Error.Code != "VALIDATION_ERROR" {
			t.Fatalf("%s: code = %q, want VALIDATION_ERROR", target, body.Error.Code)
		}
	}
}

func TestListRejectsInvalidCursor(t *testing.T) {
	h := NewHandler(&fakeRepository{})
	req := authenticatedRequest("/api/v1/me/problems?cursor=not-base64", 42)
	w := httptest.NewRecorder()

	h.List(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestListPaginatesWithNextCursor(t *testing.T) {
	created1 := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC)
	created2 := created1.Add(-time.Minute)
	created3 := created2.Add(-time.Minute)
	repo := &fakeRepository{items: []Problem{
		{ID: 3, Title: "Three", CreatedAt: created1},
		{ID: 2, Title: "Two", CreatedAt: created2},
		{ID: 1, Title: "One", CreatedAt: created3},
	}}
	h := NewHandler(repo)
	req := authenticatedRequest("/api/v1/me/problems?limit=2&status=reviewing&platform=leetcode", 42)
	w := httptest.NewRecorder()

	h.List(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if repo.userID != 42 {
		t.Fatalf("userID = %d, want 42", repo.userID)
	}
	if repo.params.Limit != 3 {
		t.Fatalf("repo limit = %d, want 3", repo.params.Limit)
	}
	if repo.params.Status != "reviewing" || repo.params.Platform != "leetcode" {
		t.Fatalf("filters = %q/%q", repo.params.Status, repo.params.Platform)
	}

	var body listEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if len(body.Data) != 2 {
		t.Fatalf("expected 2 visible items, got %d", len(body.Data))
	}
	if body.Meta.NextCursor == nil {
		t.Fatal("nextCursor must be set when another page exists")
	}
	cursor, err := decodeCursor(*body.Meta.NextCursor)
	if err != nil {
		t.Fatalf("nextCursor must be decodable: %v", err)
	}
	if !cursor.CreatedAt.Equal(created2) || cursor.ID != 2 {
		t.Fatalf("cursor = (%s,%d), want (%s,2)", cursor.CreatedAt, cursor.ID, created2)
	}
}

func TestListAcceptsCursor(t *testing.T) {
	createdAt := time.Date(2026, 7, 1, 11, 0, 0, 0, time.UTC)
	cursor := encodeCursor(Cursor{CreatedAt: createdAt, ID: 10})
	repo := &fakeRepository{}
	h := NewHandler(repo)
	req := authenticatedRequest("/api/v1/me/problems?cursor="+cursor, 42)
	w := httptest.NewRecorder()

	h.List(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !repo.params.Cursor.CreatedAt.Equal(createdAt) || repo.params.Cursor.ID != 10 {
		t.Fatalf("cursor = (%s,%d), want (%s,10)", repo.params.Cursor.CreatedAt, repo.params.Cursor.ID, createdAt)
	}
}

func TestListEmptyStateUsesEmptyArray(t *testing.T) {
	h := NewHandler(&fakeRepository{})
	req := authenticatedRequest("/api/v1/me/problems", 42)
	w := httptest.NewRecorder()

	h.List(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var body listEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if body.Data == nil {
		t.Fatal("data must be an empty array, not null")
	}
	if len(body.Data) != 0 {
		t.Fatalf("expected empty data, got %d items", len(body.Data))
	}
	if body.Meta.NextCursor != nil {
		t.Fatal("nextCursor must be null on the last page")
	}
}

// TestListHasNoDoubleDataNesting is a contract-shape guard against the
// regression where the list response wrapped ListResponse (which already has
// data+meta) inside response.JSON, producing { data: { data, meta } }.
// The fix (PR #247) calls JSONWithMeta with the items slice directly. This
// test ensures the top-level "data" is an array, not an object.
func TestListHasNoDoubleDataNesting(t *testing.T) {
	repo := &fakeRepository{items: []Problem{{ID: 1, Title: "One"}}}
	h := NewHandler(repo)
	req := authenticatedRequest("/api/v1/me/problems", 42)
	w := httptest.NewRecorder()

	h.List(w, req)

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v\nbody: %s", err, w.Body.String())
	}
	data, ok := body["data"].([]any)
	if !ok {
		t.Fatalf("expected top-level \"data\" to be a JSON array (no double nesting), "+
			"got %T; body: %s", body["data"], w.Body.String())
	}
	if len(data) != 1 {
		t.Fatalf("expected 1 item, got %d; body: %s", len(data), w.Body.String())
	}
	// "meta" must be top-level (sibling of data), not nested inside data.
	if _, nested := data[0].(map[string]any)["data"]; nested {
		t.Fatalf("detected double nesting: first data item has a nested \"data\" key; body: %s", w.Body.String())
	}
}

// --- Detail (GET /me/problems/{id}) tests ---

// routeProblemsHandler wraps the handler in a chi router so that URL params
// (e.g. {problemId}) are populated by the chi router, just like in production.
func routeProblemsHandler(h *Handler) http.Handler {
	r := chi.NewRouter()
	r.Route("/me/problems", func(r chi.Router) {
		RegisterRoutes(r, h)
	})
	return r
}

// TestGetReturnsCamelCaseProblemDetail is the contract-shape assertion for the
// detail endpoint: every field must be camelCase (matching the list model and
// docs), and no snake_case key may leak through. This guards issue #243.
func TestGetReturnsCamelCaseProblemDetail(t *testing.T) {
	nextReview := time.Date(2026, 7, 2, 9, 0, 0, 0, time.UTC)
	solved := time.Date(2026, 6, 28, 20, 10, 0, 0, time.UTC)
	created := solved
	updated := nextReview
	rating := "normal"
	note := "remember the empty-array edge case"
	repo := &fakeRepository{
		detail: ProblemDetail{
			ID:           7,
			ExternalID:   "leetcode_two_sum",
			Title:        "Two Sum",
			URL:          "https://leetcode.com/problems/two-sum/",
			Platform:     "leetcode",
			Difficulty:   "easy",
			Pattern:      &ProblemPattern{ID: "two_pointers", Name: "Two Pointers"},
			Status:       "reviewing",
			NextReviewAt: &nextReview,
			LastRating:   &rating,
			SolvedAt:     &solved,
			HintsUsed:    3,
			Note:         &note,
			CreatedAt:    created,
			UpdatedAt:    updated,
		},
	}
	h := routeProblemsHandler(NewHandler(repo))
	req := withUser(httptest.NewRequest(http.MethodGet, "/me/problems/7", nil), 42)
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if repo.detailID != 7 {
		t.Fatalf("detailID = %d, want 7", repo.detailID)
	}

	var body struct {
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v\nbody: %s", err, w.Body.String())
	}
	if body.Data == nil {
		t.Fatalf("expected data object, got nil; body: %s", w.Body.String())
	}

	// camelCase keys must be present.
	for _, key := range []string{
		"id", "externalId", "title", "url", "platform", "difficulty",
		"status", "nextReviewAt", "lastRating", "solvedAt",
		"hintsUsed", "note", "createdAt", "updatedAt",
	} {
		if _, ok := body.Data[key]; !ok {
			t.Errorf("expected camelCase key %q in detail response; body: %s", key, w.Body.String())
		}
	}

	// snake_case keys must NOT be present.
	for _, key := range []string{
		"external_id", "next_review_at", "last_rating", "solved_at", "created_at", "updated_at",
	} {
		if _, ok := body.Data[key]; ok {
			t.Errorf("snake_case key %q must not appear in detail response; body: %s", key, w.Body.String())
		}
	}

	if body.Data["hintsUsed"] != float64(3) {
		t.Errorf("hintsUsed = %v, want 3", body.Data["hintsUsed"])
	}
}

func TestGetRequiresAuth(t *testing.T) {
	h := routeProblemsHandler(NewHandler(&fakeRepository{}))
	req := httptest.NewRequest(http.MethodGet, "/me/problems/1", nil)
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestGetRejectsInvalidProblemID(t *testing.T) {
	h := routeProblemsHandler(NewHandler(&fakeRepository{}))
	req := withUser(httptest.NewRequest(http.MethodGet, "/me/problems/not-a-number", nil), 42)
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestGetReturnsNotFound(t *testing.T) {
	repo := &fakeRepository{getErr: errNotFound}
	h := routeProblemsHandler(NewHandler(repo))
	req := withUser(httptest.NewRequest(http.MethodGet, "/me/problems/999", nil), 42)
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

// withUser injects the authenticated user ID into the request context.
func withUser(r *http.Request, userID int64) *http.Request {
	return r.WithContext(auth.ContextWithUserID(r.Context(), userID))
}

func authenticatedRequest(target string, userID int64) *http.Request {
	req := httptest.NewRequest(http.MethodGet, target, nil)
	return req.WithContext(auth.ContextWithUserID(req.Context(), userID))
}

type fakeRepository struct {
	userID   int64
	params   ListParams
	items    []Problem
	err      error
	detail   ProblemDetail
	detailID int64
	getErr   error
}

func (f *fakeRepository) List(_ context.Context, userID int64, params ListParams) ([]Problem, error) {
	f.userID = userID
	f.params = params
	if f.err != nil {
		return nil, f.err
	}
	if f.items == nil {
		return []Problem{}, nil
	}
	return f.items, nil
}

func (f *fakeRepository) GetByID(_ context.Context, _, problemID int64) (ProblemDetail, error) {
	f.detailID = problemID
	return f.detail, f.getErr
}

func (f *fakeRepository) Save(_ context.Context, _, _ int64) (string, error) {
	return "not_started", nil
}

type listEnvelope struct {
	Data []Problem     `json:"data"`
	Meta response.Meta `json:"meta"`
}
