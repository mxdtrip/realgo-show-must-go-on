package practice

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/httpjson"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

type repository interface {
	List(ctx context.Context, userID int64) ([]Subpattern, error)
	Add(ctx context.Context, userID int64, code string) error
	Remove(ctx context.Context, userID int64, code string) error
}

type Handler struct {
	repo repository
}

func NewHandler(repo repository) *Handler {
	return &Handler{repo: repo}
}

// RegisterRoutes mounts the practice routes on r (expected base: /me/practice).
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/", h.List)
	r.Post("/subpatterns", h.Add)
	r.Delete("/subpatterns/{code}", h.Remove)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	items, err := h.repo.List(r.Context(), userID)
	if err != nil {
		slog.Error("practice: List failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not list practice subpatterns")
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"subpatterns": items})
}

type addRequest struct {
	Code string `json:"code"`
}

func (h *Handler) Add(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	var req addRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}
	code := strings.TrimSpace(req.Code)
	if code == "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "code is required")
		return
	}

	if err := h.repo.Add(r.Context(), userID, code); err != nil {
		if errors.Is(err, ErrSubpatternNotFound) {
			slog.Warn("practice: Add failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.String("code", code))
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", "subpattern not found")
			return
		}
		slog.Error("practice: Add failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.String("code", code))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not add subpattern to practice")
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"code": code, "active": true})
}

func (h *Handler) Remove(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	code := strings.TrimSpace(chi.URLParam(r, "code"))
	if code == "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "code is required")
		return
	}

	if err := h.repo.Remove(r.Context(), userID, code); err != nil {
		slog.Error("practice: Remove failed", slog.Any("err", err), slog.Int64("user_id", userID), slog.String("code", code))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not remove subpattern from practice")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
