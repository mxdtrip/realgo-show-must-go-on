package roadmap

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

type repository interface {
	Get(ctx context.Context, userID int64) (Response, error)
	Clear(ctx context.Context, userID int64) error
}

type Handler struct {
	repo repository
}

func NewHandler(repo repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("roadmap: Get failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	data, err := h.repo.Get(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			slog.Warn("roadmap: Get failed", slog.Any("err", err), slog.Int64("user_id", userID))
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", "user not found")
			return
		}
		slog.Error("roadmap: Get failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load roadmap")
		return
	}

	response.JSON(w, http.StatusOK, data)
}

// Delete handles DELETE /me/roadmap — clears the onboarding-set target so
// the roadmap goes back to the empty "build your roadmap" state. Solve
// history and progress are untouched; this only resets personalization.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("roadmap: Delete failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	if err := h.repo.Clear(r.Context(), userID); err != nil {
		slog.Error("roadmap: Delete failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not clear roadmap")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
