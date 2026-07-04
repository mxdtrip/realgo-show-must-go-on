package companies

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

// Handler has no dependencies (no repo/pool) because Search reads from the
// static in-memory catalog — see repository.go.
type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	limit := defaultSearchLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			slog.Warn("companies: Search failed", slog.Any("err", err), slog.String("limit", raw))
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "limit must be an integer")
			return
		}
		limit = parsed
	}

	response.JSON(w, http.StatusOK, Search(r.URL.Query().Get("query"), limit))
}
