package patterns

import (
	"context"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

const (
	defaultWeakPatternsLimit = 5
	maxWeakPatternsLimit     = 20
)

type Handler struct {
	repo repository
}

type repository interface {
	ListWeak(ctx context.Context, userID int64, limit int32) ([]WeakPattern, error)
}

func NewHandler(repo repository) *Handler {
	return &Handler{repo: repo}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/weak", h.ListWeak)
}

func (h *Handler) ListWeak(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.ParseInt(r.URL.Query().Get("user_id"), 10, 64)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "invalid_user_id", "user_id must be a valid integer")
		return
	}

	items, err := h.repo.ListWeak(r.Context(), userID, weakPatternsLimit(r))
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, items)
}

func weakPatternsLimit(r *http.Request) int32 {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		return defaultWeakPatternsLimit
	}
	if limit > maxWeakPatternsLimit {
		return maxWeakPatternsLimit
	}
	return int32(limit)
}
