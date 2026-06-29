package reviews

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGetTodayReviews_InvalidUserID(t *testing.T) {
	h := NewHandler(nil, nil)
	r := httptest.NewRequest(http.MethodGet, "/reviews/today?user_id=abc", nil)
	w := httptest.NewRecorder()
	h.GetTodayReviews(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestProcessAttempt_InvalidRating(t *testing.T) {
	h := NewHandler(nil, nil)
	r := httptest.NewRequest(http.MethodPost, "/reviews/1/attempt?user_id=1",
		strings.NewReader(`{"rating": 5, "duration_sec": 10}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ProcessAttempt(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestGetStats_InvalidUserID(t *testing.T) {
	h := NewHandler(nil, nil)
	r := httptest.NewRequest(http.MethodGet, "/reviews/stats?user_id=abc", nil)
	w := httptest.NewRecorder()
	h.GetStats(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}
