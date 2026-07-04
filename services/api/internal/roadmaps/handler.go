package roadmaps

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

const neetcode150Code = "neetcode_150"

type Handler struct {
	repo repository
}

type repository interface {
	List(ctx context.Context, code string) ([]Item, error)
}

func NewHandler(repo repository) *Handler {
	return &Handler{repo: repo}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/neetcode_150", h.GetNeetCode150)
}

func (h *Handler) GetNeetCode150(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.List(r.Context(), neetcode150Code)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not load roadmap")
		return
	}
	response.JSON(w, http.StatusOK, Response{Code: neetcode150Code, Items: items})
}
