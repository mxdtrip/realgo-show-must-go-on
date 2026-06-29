package reviews

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

type Handler struct {
	svc Service
	log interface{ Error(string, ...any) }
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
	userID, err := strconv.ParseInt(r.URL.Query().Get("user_id"), 10, 64)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "invalid_user_id", "user_id must be a valid integer")
		return
	}

	items, err := h.svc.GetTodayReviews(r.Context(), userID)
	if err != nil {
		h.log.Error("GetTodayReviews", "err", err)
		response.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, TodayReviewsResponse{Data: items})
}

func (h *Handler) ProcessAttempt(w http.ResponseWriter, r *http.Request) {
	scheduleID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "invalid_schedule_id", "schedule id must be a valid integer")
		return
	}

	var req AttemptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Fail(w, http.StatusBadRequest, "invalid_request", ErrInvalidRequest.Error())
		return
	}

	if req.Rating < 1 || req.Rating > 4 {
		response.Fail(w, http.StatusBadRequest, "invalid_rating", ErrInvalidRating.Error())
		return
	}

	userID, _ := strconv.ParseInt(r.URL.Query().Get("user_id"), 10, 64)

	resp, err := h.svc.ProcessAttempt(r.Context(), scheduleID, userID, req)
	if err != nil {
		if errors.Is(err, ErrReviewNotFound) {
			response.Fail(w, http.StatusNotFound, "not_found", err.Error())
			return
		}
		h.log.Error("ProcessAttempt", "err", err)
		response.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, resp)
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.ParseInt(r.URL.Query().Get("user_id"), 10, 64)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "invalid_user_id", "user_id must be a valid integer")
		return
	}

	stats, err := h.svc.GetStats(r.Context(), userID)
	if err != nil {
		h.log.Error("GetStats", "err", err)
		response.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, stats)
}
