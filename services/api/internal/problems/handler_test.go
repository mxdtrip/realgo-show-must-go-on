package problems

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
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
		"/api/v1/me/problems?platform=hackerrank",
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
	if len(body.Data.Data) != 2 {
		t.Fatalf("expected 2 visible items, got %d", len(body.Data.Data))
	}
	if body.Data.Meta.NextCursor == nil {
		t.Fatal("nextCursor must be set when another page exists")
	}
	cursor, err := decodeCursor(*body.Data.Meta.NextCursor)
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
	if body.Data.Data == nil {
		t.Fatal("data must be an empty array, not null")
	}
	if len(body.Data.Data) != 0 {
		t.Fatalf("expected empty data, got %d items", len(body.Data.Data))
	}
	if body.Data.Meta.NextCursor != nil {
		t.Fatal("nextCursor must be null on the last page")
	}
}

func authenticatedRequest(target string, userID int64) *http.Request {
	req := httptest.NewRequest(http.MethodGet, target, nil)
	return req.WithContext(auth.ContextWithUserID(req.Context(), userID))
}

type fakeRepository struct {
	userID int64
	params ListParams
	items  []Problem
	err    error
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

type listEnvelope struct {
	Data ListResponse `json:"data"`
}
