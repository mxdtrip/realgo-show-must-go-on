package roadmaps

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

const neetcode150Code = "neetcode_150"

type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/neetcode_150", h.GetNeetCode150)
}

func (h *Handler) GetNeetCode150(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.List(r.Context(), neetcode150Code)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, Response{Code: neetcode150Code, Items: items})
}
