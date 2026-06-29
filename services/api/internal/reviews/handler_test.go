package reviews

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
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
		strings.NewReader(`{"rating": "again", "duration_sec": 10}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	routeReviews(h).ServeHTTP(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestProcessAttempt_AcceptsProductRatings(t *testing.T) {
	for _, rating := range []string{"hard", "normal", "easy"} {
		h := NewHandler(fakeService{}, nil)
		r := httptest.NewRequest(http.MethodPost, "/reviews/1/attempt?user_id=1",
			strings.NewReader(`{"rating": "`+rating+`", "duration_sec": 10}`))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		routeReviews(h).ServeHTTP(w, r)

		if w.Code != http.StatusOK {
			t.Errorf("%s: expected 200, got %d", rating, w.Code)
		}
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

func routeReviews(h *Handler) http.Handler {
	r := chi.NewRouter()
	r.Route("/reviews", func(r chi.Router) {
		RegisterRoutes(r, h)
	})
	return r
}

type fakeService struct{}

func (fakeService) GetTodayReviews(context.Context, int64) ([]ReviewItem, error) {
	return nil, nil
}

func (fakeService) ProcessAttempt(context.Context, int64, int64, AttemptRequest) (AttemptResponse, error) {
	return AttemptResponse{}, nil
}

func (fakeService) GetStats(context.Context, int64) (StatsResponse, error) {
	return StatsResponse{}, nil
}
