package v1

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/controller/v1/request"
	v1response "github.com/mxdtrip/freeburger/services/api/internal/controller/v1/response"
	"github.com/mxdtrip/freeburger/services/api/internal/server/httpjson"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
	"github.com/mxdtrip/freeburger/services/api/internal/service"
)

const defaultQueueLimit = 50
const maxQueueLimit = 100

// ReviewHandler обрабатывает запросы для review endpoints.
type ReviewHandler struct {
	svc service.ReviewService
}

func NewReviewHandler(svc service.ReviewService) *ReviewHandler {
	return &ReviewHandler{svc: svc}
}

// RegisterReviewRoutes подключает маршруты для reviews.
func RegisterReviewRoutes(r chi.Router, h *ReviewHandler) {
	r.Get("/queue", h.GetQueue)
	r.Post("/{reviewId}/rate", h.RateReview)
	r.Get("/stats", h.GetStats)
}

// GetQueue: GET /me/reviews/queue
func (h *ReviewHandler) GetQueue(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	status := r.URL.Query().Get("status")
	if status == "" {
		status = "due"
	}
	if !validQueueStatus(status) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "status must be due or upcoming")
		return
	}

	limit := parseLimit(r, defaultQueueLimit)

	resp, err := h.svc.GetQueue(r.Context(), userID, status, limit)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load review queue")
		return
	}

	response.JSONWithMeta(w, http.StatusOK, resp.Data, resp.Meta)
}

// RateReview: POST /me/reviews/{reviewId}/rate
func (h *ReviewHandler) RateReview(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	reviewID, err := strconv.ParseInt(chi.URLParam(r, "reviewId"), 10, 64)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid reviewId")
		return
	}

	var req request.RateReviewRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}

	if !req.Valid() {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", service.ErrInvalidRating.Error())
		return
	}

	// Парсим reviewedAt из запроса (ISO 8601)
	reviewedAt, err := time.Parse(time.RFC3339, req.ReviewedAt)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid reviewedAt format, expected ISO 8601")
		return
	}

	data, err := h.svc.RateReview(r.Context(), reviewID, userID, req.Rating, reviewedAt)
	if err != nil {
		if errors.Is(err, service.ErrReviewNotFound) {
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", err.Error())
			return
		}
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not rate review")
		return
	}

	response.JSON(w, http.StatusOK, data)
}

// GetStats: GET /me/reviews/stats
func (h *ReviewHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserID(r)
	if err != nil {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	resp, err := h.svc.GetStats(r.Context(), userID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load review stats")
		return
	}

	response.JSON(w, http.StatusOK, v1response.StatsResponse{
		TotalReviews:  resp.TotalReviews,
		NewCards:      resp.NewCards,
		LearningCards: resp.LearningCards,
		ReviewCards:   resp.ReviewCards,
	})
}

// getUserID извлекает userID из контекста авторизации.
func getUserID(r *http.Request) (int64, error) {
	// Интеграция с auth.UserIDFromContext
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		return 0, errors.New("user not authenticated")
	}
	return userID, nil
}

func parseLimit(r *http.Request, defaultVal int32) int32 {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		return defaultVal
	}
	if limit > maxQueueLimit {
		return maxQueueLimit
	}
	return int32(limit)
}

func validQueueStatus(status string) bool {
	return status == "due" || status == "upcoming"
}
