package extension

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

const (
	defaultRecentEventsLimit = 10
	maxRecentEventsLimit     = 50
)

type extensionStatusService interface {
	Get(ctx context.Context, userID int64, limit int32) (StatusResponse, error)
}

// StatusHandler serves extension status endpoints.
type StatusHandler struct {
	svc extensionStatusService
}

// NewStatusHandler builds the extension status HTTP handler.
func NewStatusHandler(svc extensionStatusService) *StatusHandler {
	return &StatusHandler{svc: svc}
}

// GetStatus: GET /api/v1/me/extension/status
func (h *StatusHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("extension: GetStatus failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	status, err := h.svc.Get(r.Context(), userID, recentEventsLimit(r))
	if err != nil {
		slog.Error("extension: GetStatus failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load extension status")
		return
	}

	response.JSON(w, http.StatusOK, status)
}

func recentEventsLimit(r *http.Request) int32 {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		return defaultRecentEventsLimit
	}
	if limit > maxRecentEventsLimit {
		return maxRecentEventsLimit
	}
	return int32(limit)
}
