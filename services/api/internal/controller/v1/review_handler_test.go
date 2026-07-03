package v1

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/controller/v1/request"
	v1response "github.com/mxdtrip/freeburger/services/api/internal/controller/v1/response"
	"github.com/mxdtrip/freeburger/services/api/internal/entity"
)

type stubReviewService struct{}

func (s *stubReviewService) GetQueue(ctx context.Context, userID int64, status string, cursor entity.ReviewQueueCursor, limit int32) (v1response.QueueResponse, error) {
	return v1response.QueueResponse{}, nil
}

func (s *stubReviewService) RateReview(ctx context.Context, reviewID, userID int64, rating string, reviewedAt time.Time) (v1response.RateReviewData, error) {
	return v1response.RateReviewData{}, nil
}

func (s *stubReviewService) GetStats(ctx context.Context, userID int64) (v1response.StatsResponse, error) {
	return v1response.StatsResponse{}, nil
}

func TestRateReview_InvalidRating(t *testing.T) {
	h := NewReviewHandler(&stubReviewService{})

	body := strings.NewReader(`{"rating": "invalid", "reviewedAt": "2026-06-30T10:00:00Z"}`)
	req := httptest.NewRequest(http.MethodPost, "/me/reviews/1/rate", body)
	req.Header.Set("Content-Type", "application/json")
	req = withUser(req, 1)

	w := httptest.NewRecorder()
	routeReviewHandler(h).ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestRateReview_ValidRating(t *testing.T) {
	h := NewReviewHandler(&stubReviewService{})

	for _, rating := range []string{"hard", "normal", "easy"} {
		body := strings.NewReader(`{"rating": "` + rating + `", "reviewedAt": "2026-06-30T10:00:00Z"}`)
		req := httptest.NewRequest(http.MethodPost, "/me/reviews/1/rate", body)
		req.Header.Set("Content-Type", "application/json")
		req = withUser(req, 1)

		w := httptest.NewRecorder()
		routeReviewHandler(h).ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("rating=%s: expected 200, got %d, body=%s", rating, w.Code, w.Body.String())
		}
	}
}

func TestRateReview_Unauthorized(t *testing.T) {
	h := NewReviewHandler(&stubReviewService{})

	body := strings.NewReader(`{"rating": "normal", "reviewedAt": "2026-06-30T10:00:00Z"}`)
	req := httptest.NewRequest(http.MethodPost, "/me/reviews/1/rate", body)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	routeReviewHandler(h).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestRequest_Valid(t *testing.T) {
	tests := []struct {
		rating   string
		expected bool
	}{
		{"hard", true},
		{"normal", true},
		{"easy", true},
		{"invalid", false},
		{"", false},
	}

	for _, tt := range tests {
		req := request.RateReviewRequest{Rating: tt.rating}
		if got := req.Valid(); got != tt.expected {
			t.Errorf("rating=%s: expected %v, got %v", tt.rating, tt.expected, got)
		}
	}
}

func routeReviewHandler(h *ReviewHandler) http.Handler {
	r := chi.NewRouter()
	r.Route("/me/reviews", func(r chi.Router) {
		RegisterReviewRoutes(r, h)
	})
	return r
}

func withUser(r *http.Request, userID int64) *http.Request {
	return r.WithContext(auth.ContextWithUserID(r.Context(), userID))
}
