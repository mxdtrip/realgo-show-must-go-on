package reviews

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/mxdtrip/freeburger/services/api/internal/auth"
)

func TestGetTodayReviews_Unauthorized(t *testing.T) {
	h := NewHandler(nil, nil)
	r := httptest.NewRequest(http.MethodGet, "/reviews/today", nil)
	w := httptest.NewRecorder()
	h.GetTodayReviews(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestGetTodayReviews_ResponseShape(t *testing.T) {
	h := NewHandler(fakeService{}, nil)
	r := withUser(httptest.NewRequest(http.MethodGet, "/reviews/today", nil), 1)
	w := httptest.NewRecorder()
	h.GetTodayReviews(w, r)

	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	var items []ReviewItem
	if err := json.Unmarshal(body["data"], &items); err != nil {
		t.Fatalf("expected data to be review items array: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one review item, got %d", len(items))
	}
}

func TestProcessAttempt_InvalidRating(t *testing.T) {
	h := NewHandler(nil, nil)
	r := withUser(httptest.NewRequest(http.MethodPost, "/reviews/1/attempt",
		strings.NewReader(`{"rating": "again", "duration_sec": 10}`)), 1)
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
		r := withUser(httptest.NewRequest(http.MethodPost, "/reviews/1/attempt",
			strings.NewReader(`{"rating": "`+rating+`", "duration_sec": 10}`)), 1)
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		routeReviews(h).ServeHTTP(w, r)

		if w.Code != http.StatusOK {
			t.Errorf("%s: expected 200, got %d", rating, w.Code)
		}
	}
}

func TestProcessAttempt_Unauthorized(t *testing.T) {
	h := NewHandler(nil, nil)
	r := httptest.NewRequest(http.MethodPost, "/reviews/1/attempt",
		strings.NewReader(`{"rating": "normal", "duration_sec": 10}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	routeReviews(h).ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestGetStats_Unauthorized(t *testing.T) {
	h := NewHandler(nil, nil)
	r := httptest.NewRequest(http.MethodGet, "/reviews/stats", nil)
	w := httptest.NewRecorder()
	h.GetStats(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestGetStats_ResponseShape(t *testing.T) {
	h := NewHandler(fakeService{}, nil)
	r := withUser(httptest.NewRequest(http.MethodGet, "/reviews/stats", nil), 1)
	w := httptest.NewRecorder()
	h.GetStats(w, r)

	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if _, nested := decodeObject(t, body["data"])["data"]; nested {
		t.Fatal("response must not contain data.data")
	}
}

func routeReviews(h *Handler) http.Handler {
	r := chi.NewRouter()
	r.Route("/reviews", func(r chi.Router) {
		RegisterRoutes(r, h)
	})
	return r
}

func withUser(r *http.Request, userID int64) *http.Request {
	return r.WithContext(auth.ContextWithUserID(r.Context(), userID))
}

type fakeService struct{}

func (fakeService) GetTodayReviews(context.Context, int64) ([]ReviewItem, error) {
	return []ReviewItem{{ID: 1}}, nil
}

func (fakeService) ProcessAttempt(context.Context, int64, int64, AttemptRequest) (AttemptResponse, error) {
	return AttemptResponse{}, nil
}

func (fakeService) GetStats(context.Context, int64) (StatsData, error) {
	return StatsData{}, nil
}

func decodeObject(t *testing.T, raw json.RawMessage) map[string]json.RawMessage {
	t.Helper()
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(raw, &obj); err != nil {
		t.Fatalf("expected object: %v", err)
	}
	return obj
}
