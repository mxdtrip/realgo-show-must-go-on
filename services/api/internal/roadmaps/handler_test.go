package roadmaps

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestGetNeetCode150_ResponseShape(t *testing.T) {
	h := NewHandler(fakeRepository{items: []Item{{Position: 1, Pattern: "Arrays & Hashing", Title: "Contains Duplicate"}}})
	r := httptest.NewRequest(http.MethodGet, "/roadmaps/neetcode_150", nil)
	w := httptest.NewRecorder()

	routeRoadmaps(h).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body struct {
		Data Response `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if body.Data.Code != neetcode150Code {
		t.Fatalf("code = %q, want %q", body.Data.Code, neetcode150Code)
	}
	if len(body.Data.Items) != 1 {
		t.Fatalf("expected one item, got %d", len(body.Data.Items))
	}
}

func TestGetNeetCode150_EmptyState(t *testing.T) {
	h := NewHandler(fakeRepository{})
	r := httptest.NewRequest(http.MethodGet, "/roadmaps/neetcode_150", nil)
	w := httptest.NewRecorder()

	routeRoadmaps(h).ServeHTTP(w, r)

	var body struct {
		Data Response `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if body.Data.Items == nil {
		t.Fatal("items must be an empty array, not null")
	}
}

func routeRoadmaps(h *Handler) http.Handler {
	r := chi.NewRouter()
	r.Route("/roadmaps", func(r chi.Router) {
		RegisterRoutes(r, h)
	})
	return r
}

type fakeRepository struct {
	items []Item
}

func (f fakeRepository) List(context.Context, string) ([]Item, error) {
	if f.items == nil {
		return []Item{}, nil
	}
	return f.items, nil
}
