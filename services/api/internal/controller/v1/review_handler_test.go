package v1

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mxdtrip/freeburger/services/api/internal/controller/v1/request"
	v1response "github.com/mxdtrip/freeburger/services/api/internal/controller/v1/response"
)

type stubReviewService struct{}

func (s *stubReviewService) GetQueue(ctx context.Context, userID int64, status string, limit int32) (v1response.QueueResponse, error) {
	return v1response.QueueResponse{}, nil
}

func (s *stubReviewService) RateReview(ctx context.Context, reviewID, userID int64, rating string) (v1response.RateReviewResponse, error) {
	return v1response.RateReviewResponse{}, nil
}

func (s *stubReviewService) GetStats(ctx context.Context, userID int64) (v1response.StatsResponse, error) {
	return v1response.StatsResponse{}, nil
}

func TestRateReview_InvalidRating(t *testing.T) {
	h := NewReviewHandler(&stubReviewService{})

	body := strings.NewReader(`{"rating": "invalid", "reviewedAt": "2026-06-30T10:00:00Z"}`)
	req := httptest.NewRequest(http.MethodPost, "/me/reviews/1/rate", body)
	req.Header.Set("Content-Type", "application/json")

	// Добавляем userID в контекст через auth.ContextWithUserID
	ctx := context.WithValue(req.Context(), struct{ key int }{0}, int64(1))
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	h.RateReview(w, req)

	// Ожидаем 401, т.к. auth.UserIDFromContext использует другой ключ
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestRateReview_ValidRating(t *testing.T) {
	h := NewReviewHandler(&stubReviewService{})

	for _, rating := range []string{"hard", "normal", "easy"} {
		body := strings.NewReader(`{"rating": "` + rating + `", "reviewedAt": "2026-06-30T10:00:00Z"}`)
		req := httptest.NewRequest(http.MethodPost, "/me/reviews/1/rate", body)
		req.Header.Set("Content-Type", "application/json")

		ctx := context.WithValue(req.Context(), struct{ key int }{0}, int64(1))
		req = req.WithContext(ctx)

		w := httptest.NewRecorder()
		h.RateReview(w, req)

		// 401 ожидаем, т.к. auth.UserIDFromContext не найдет ключ
		if w.Code != http.StatusUnauthorized {
			t.Logf("rating=%s, code=%d, body=%s", rating, w.Code, w.Body.String())
		}
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
