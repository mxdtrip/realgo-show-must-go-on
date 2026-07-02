package patterns

import (
	"context"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

const (
	// Five items are enough for the dashboard preview without turning the MVP
	// endpoint into a full analytics report.
	defaultWeakPatternsLimit = 5
	// Keep the ad-hoc limit bounded until this endpoint has pagination.
	maxWeakPatternsLimit = 20
)

type Handler struct {
	repo repository
}

type repository interface {
	List(ctx context.Context, userID int64) ([]Pattern, error)
	ListWeak(ctx context.Context, userID int64, limit int32) ([]WeakPattern, error)
}

func NewHandler(repo repository) *Handler {
	return &Handler{repo: repo}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/", h.List)
	r.Get("/weak", h.ListWeak)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "authentication required")
		return
	}

	items, err := h.repo.List(r.Context(), userID)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not list patterns")
		return
	}

	response.JSON(w, http.StatusOK, map[string][]Pattern{"patterns": items})
}

func (h *Handler) ListWeak(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	items, err := h.repo.ListWeak(r.Context(), userID, weakPatternsLimit(r))
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not list weak patterns")
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
