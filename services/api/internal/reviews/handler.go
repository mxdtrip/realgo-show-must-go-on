package reviews

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/request"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

type Handler struct {
	svc Service
	log interface{ Error(string, ...any) }
}

var errInvalidRequest = errors.New("invalid request")

type Service interface {
	GetTodayReviews(ctx context.Context, userID int64) ([]ReviewItem, error)
	ProcessAttempt(ctx context.Context, scheduleID, userID int64, req AttemptRequest) (AttemptResponse, error)
	GetStats(ctx context.Context, userID int64) (StatsData, error)
}

func NewHandler(svc Service, log interface{ Error(string, ...any) }) *Handler {
	return &Handler{svc: svc, log: log}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/today", h.GetTodayReviews)
	r.Post("/{id}/attempt", h.ProcessAttempt)
	r.Get("/stats", h.GetStats)
}

func (h *Handler) GetTodayReviews(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	items, err := h.svc.GetTodayReviews(r.Context(), userID)
	if err != nil {
		h.log.Error("GetTodayReviews", "err", err)
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not list reviews")
		return
	}

	response.JSON(w, http.StatusOK, items)
}

func (h *Handler) ProcessAttempt(w http.ResponseWriter, r *http.Request) {
	scheduleID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "invalid_schedule_id", "schedule id must be a valid integer")
		return
	}

	var req AttemptRequest
	if !request.DecodeJSON(w, r, &req) {
		return
	}

	if !validRating(req.Rating) {
		response.Fail(w, http.StatusBadRequest, "invalid_rating", ErrInvalidRating.Error())
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	resp, err := h.svc.ProcessAttempt(r.Context(), scheduleID, userID, req)
	if err != nil {
		if errors.Is(err, ErrReviewNotFound) {
			response.Fail(w, http.StatusNotFound, "not_found", err.Error())
			return
		}
		h.log.Error("ProcessAttempt", "err", err)
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not process review attempt")
		return
	}

	response.JSON(w, http.StatusOK, resp)
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	stats, err := h.svc.GetStats(r.Context(), userID)
	if err != nil {
		h.log.Error("GetStats", "err", err)
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not load review stats")
		return
	}

	response.JSON(w, http.StatusOK, stats)
}

func validRating(rating string) bool {
	switch rating {
	case "hard", "normal", "easy":
		return true
	default:
		return false
	}
}
