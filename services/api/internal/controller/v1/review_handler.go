package v1

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/controller/v1/request"
	v1response "github.com/mxdtrip/freeburger/services/api/internal/controller/v1/response"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
	"github.com/mxdtrip/freeburger/services/api/internal/service"
)

const defaultQueueLimit = 50

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

	limit := parseLimit(r, defaultQueueLimit)

	resp, err := h.svc.GetQueue(r.Context(), userID, status, limit)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, v1response.QueueResponse{
		Data: resp.Data,
		Meta: v1response.QueueMeta{NextCursor: resp.Meta.NextCursor},
	})
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}

	if !req.Valid() {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", service.ErrInvalidRating.Error())
		return
	}

	resp, err := h.svc.RateReview(r.Context(), reviewID, userID, req.Rating)
	if err != nil {
		if errors.Is(err, service.ErrReviewNotFound) {
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", err.Error())
			return
		}
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, v1response.RateReviewResponse{
		ReviewID:     resp.ReviewID,
		Rating:       resp.Rating,
		NextReviewAt: resp.NextReviewAt,
		Status:       resp.Status,
	})
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
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
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
	return int32(limit)
}
