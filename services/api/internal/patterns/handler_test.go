package patterns

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/mxdtrip/freeburger/services/api/internal/auth"
)

func TestListWeak_Unauthorized(t *testing.T) {
	h := NewHandler(nil)
	r := httptest.NewRequest(http.MethodGet, "/patterns/weak", nil)
	w := httptest.NewRecorder()

	h.ListWeak(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestListWeak_ResponseShape(t *testing.T) {
	h := NewHandler(fakeRepository{items: []WeakPattern{{PatternCode: "dp", Pattern: "Dynamic Programming", HardCount: 3, ReviewCount: 4, LowConfidence: true}}})
	r := withUser(httptest.NewRequest(http.MethodGet, "/patterns/weak", nil), 1)
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
	r := withUser(httptest.NewRequest(http.MethodGet, "/patterns/weak", nil), 1)
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

func withUser(r *http.Request, userID int64) *http.Request {
	return r.WithContext(auth.ContextWithUserID(r.Context(), userID))
}

type fakeRepository struct {
	items []WeakPattern
}

func (f fakeRepository) List(context.Context, int64) ([]Pattern, error) {
	return []Pattern{}, nil
}

func (f fakeRepository) ListWeak(context.Context, int64, int32) ([]WeakPattern, error) {
	if f.items == nil {
		return []WeakPattern{}, nil
	}
	return f.items, nil
}
