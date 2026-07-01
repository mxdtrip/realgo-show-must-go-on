package companies

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSearch_CaseInsensitiveSubstring(t *testing.T) {
	h := NewHandler()
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

func TestSearch_EmptyQueryReturnsEmptyArray(t *testing.T) {
	got := Search("", 8)
	if got == nil {
		t.Fatal("empty query must return an empty array, not nil")
	}
	if len(got) != 0 {
		t.Fatalf("len = %d, want 0", len(got))
	}
}

func TestSearch_LimitClamped(t *testing.T) {
	if got := len(Search("a", 1)); got != 1 {
		t.Fatalf("limited len = %d, want 1", got)
	}
	if got := clampLimit(99); got != maxSearchLimit {
		t.Fatalf("clamped limit = %d, want %d", got, maxSearchLimit)
	}
	if got := clampLimit(-1); got != defaultSearchLimit {
		t.Fatalf("default limit = %d, want %d", got, defaultSearchLimit)
	}
}

func TestSearch_InvalidLimit(t *testing.T) {
	h := NewHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/companies/search?query=goo&limit=abc", nil)
	w := httptest.NewRecorder()

	h.Search(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}
