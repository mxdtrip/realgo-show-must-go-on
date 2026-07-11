package companies

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// catalogOnly exercises the real Repository logic with no database pool:
// the curated catalog layer must keep working on its own.
func catalogOnly() *Repository { return NewRepository(nil) }

func TestSearch_CaseInsensitiveSubstring(t *testing.T) {
	h := NewHandler(catalogOnly())
	req := httptest.NewRequest(http.MethodGet, "/api/v1/companies/search?query=goo&limit=8", nil)
	w := httptest.NewRecorder()

	h.Search(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var body struct {
		Data []Company `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if len(body.Data) < 2 {
		t.Fatalf("expected Google suggestions, got %+v", body.Data)
	}
	if body.Data[0].ID != "cmp_google" || body.Data[1].ID != "cmp_google_cloud" {
		t.Fatalf("unexpected suggestions: %+v", body.Data)
	}
}

func TestSearch_AliasStillMatches(t *testing.T) {
	got, err := catalogOnly().Search(context.Background(), "facebook", 8)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 || got[0].ID != "cmp_meta" {
		t.Fatalf("alias search = %+v, want cmp_meta", got)
	}
}

func TestSearch_EmptyQueryReturnsEmptyArray(t *testing.T) {
	got, err := catalogOnly().Search(context.Background(), "", 8)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil {
		t.Fatal("empty query must return an empty array, not nil")
	}
	if len(got) != 0 {
		t.Fatalf("len = %d, want 0", len(got))
	}
}

func TestSearch_LimitClamped(t *testing.T) {
	got, err := catalogOnly().Search(context.Background(), "a", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("limited len = %d, want 1", len(got))
	}
	if got := clampLimit(99); got != maxSearchLimit {
		t.Fatalf("clamped limit = %d, want %d", got, maxSearchLimit)
	}
	if got := clampLimit(-1); got != defaultSearchLimit {
		t.Fatalf("default limit = %d, want %d", got, defaultSearchLimit)
	}
}

func TestSearch_InvalidLimit(t *testing.T) {
	h := NewHandler(catalogOnly())
	req := httptest.NewRequest(http.MethodGet, "/api/v1/companies/search?query=goo&limit=abc", nil)
	w := httptest.NewRecorder()

	h.Search(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

type failingSearcher struct{}

func (failingSearcher) Search(context.Context, string, int) ([]Company, error) {
	return nil, errors.New("boom")
}

func TestSearch_RepositoryErrorIs500(t *testing.T) {
	h := NewHandler(failingSearcher{})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/companies/search?query=goo", nil)
	w := httptest.NewRecorder()

	h.Search(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusInternalServerError)
	}
}

func TestEscapeLike(t *testing.T) {
	if got := escapeLike(`100%_a\b`); got != `100\%\_a\\b` {
		t.Fatalf("escapeLike = %q", got)
	}
}
