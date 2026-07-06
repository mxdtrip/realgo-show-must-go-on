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

func TestGetDetail_Unauthorized(t *testing.T) {
	h := NewHandler(nil)
	r := httptest.NewRequest(http.MethodGet, "/patterns/two_pointers", nil)
	w := httptest.NewRecorder()

	h.GetDetail(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestGetDetail_Found(t *testing.T) {
	want := PatternDetail{
		Code:        "two_pointers",
		Name:        "Two Pointers",
		Description: "Два индекса двигаются по одной структуре.",
		Techniques:  []string{"Opposite pointers"},
	}
	h := NewHandler(fakeRepository{detail: want})
	r := withUser(httptest.NewRequest(http.MethodGet, "/patterns/two_pointers", nil), 1)
	w := httptest.NewRecorder()

	routePatterns(h).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body struct {
		Data PatternDetail `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if body.Data.Code != want.Code {
		t.Fatalf("code = %q, want %q", body.Data.Code, want.Code)
	}
}

func TestGetDetail_NotFound(t *testing.T) {
	h := NewHandler(fakeRepository{detailErr: ErrPatternNotFound})
	r := withUser(httptest.NewRequest(http.MethodGet, "/patterns/unknown-code", nil), 1)
	w := httptest.NewRecorder()

	routePatterns(h).ServeHTTP(w, r)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
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
	items     []WeakPattern
	detail    PatternDetail
	detailErr error
	atlas     AtlasResponse
	atlasErr  error
	companies []AtlasCompany
	node      NodeDetail
	nodeErr   error
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

func (f fakeRepository) GetByCode(context.Context, string) (PatternDetail, error) {
	if f.detailErr != nil {
		return PatternDetail{}, f.detailErr
	}
	return f.detail, nil
}

func (f fakeRepository) GetAtlas(context.Context, int64, string) (AtlasResponse, error) {
	if f.atlasErr != nil {
		return AtlasResponse{}, f.atlasErr
	}
	return f.atlas, nil
}

func (f fakeRepository) ListCompanies(context.Context) ([]AtlasCompany, error) {
	if f.companies == nil {
		return []AtlasCompany{}, nil
	}
	return f.companies, nil
}

func (f fakeRepository) GetAtlasNode(context.Context, int64, string) (NodeDetail, error) {
	if f.nodeErr != nil {
		return NodeDetail{}, f.nodeErr
	}
	return f.node, nil
}
