package patterns

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestListWeak_InvalidUserID(t *testing.T) {
	h := NewHandler(nil)
	r := httptest.NewRequest(http.MethodGet, "/patterns/weak?user_id=abc", nil)
	w := httptest.NewRecorder()

	h.ListWeak(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestListWeak_ResponseShape(t *testing.T) {
	h := NewHandler(fakeRepository{items: []WeakPattern{{PatternCode: "dp", Pattern: "Dynamic Programming", HardCount: 3, ReviewCount: 4, LowConfidence: true}}})
	r := httptest.NewRequest(http.MethodGet, "/patterns/weak?user_id=1", nil)
	w := httptest.NewRecorder()

	routePatterns(h).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body struct {
		Data []WeakPattern `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if len(body.Data) != 1 {
		t.Fatalf("expected one weak pattern, got %d", len(body.Data))
	}
}

func TestListWeak_EmptyState(t *testing.T) {
	h := NewHandler(fakeRepository{})
	r := httptest.NewRequest(http.MethodGet, "/patterns/weak?user_id=1", nil)
	w := httptest.NewRecorder()

	routePatterns(h).ServeHTTP(w, r)

	var body struct {
		Data []WeakPattern `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if body.Data == nil {
		t.Fatal("data must be an empty array, not null")
	}
}

func TestWeakPatternsLimit(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/patterns/weak?limit=99", nil)
	if got := weakPatternsLimit(req); got != maxWeakPatternsLimit {
		t.Fatalf("limit = %d, want %d", got, maxWeakPatternsLimit)
	}
}

func routePatterns(h *Handler) http.Handler {
	r := chi.NewRouter()
	r.Route("/patterns", func(r chi.Router) {
		RegisterRoutes(r, h)
	})
	return r
}

type fakeRepository struct {
	items []WeakPattern
}

func (f fakeRepository) ListWeak(context.Context, int64, int32) ([]WeakPattern, error) {
	if f.items == nil {
		return []WeakPattern{}, nil
	}
	return f.items, nil
}
