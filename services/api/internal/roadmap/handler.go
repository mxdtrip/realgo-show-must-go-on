package roadmap

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/httpjson"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

type repository interface {
	Get(ctx context.Context, userID int64) (Response, error)
	Preview(ctx context.Context, userID int64, req ConfigRequest) (Response, error)
	Save(ctx context.Context, userID int64, req ConfigRequest) (Response, error)
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

// Preview calculates a roadmap without persisting it. It powers the live
// onboarding preview and the "rebuild future weeks" confirmation on /roadmap.
func (h *Handler) Preview(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, false)
}

// Put calculates and atomically persists the roadmap config, ordered
// subpatterns and user target. Repeating the same request is deterministic.
func (h *Handler) Put(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, true)
}

func (h *Handler) mutate(w http.ResponseWriter, r *http.Request, persist bool) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}
	var req ConfigRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}
	if field, message := validateConfig(req); field != "" {
		response.FailWithDetails(w, http.StatusBadRequest, "VALIDATION_ERROR", message, field)
		return
	}
	if req.PriorityMode == "" {
		req.PriorityMode = PriorityBalanced
	}

	var data Response
	var err error
	if persist {
		data, err = h.repo.Save(r.Context(), userID, req)
	} else {
		data, err = h.repo.Preview(r.Context(), userID, req)
	}
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", "user not found")
			return
		}
		slog.Error("roadmap: mutation failed", slog.Any("err", err), slog.Bool("persist", persist), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not calculate roadmap")
		return
	}
	response.JSON(w, http.StatusOK, data)
}

func validateConfig(req ConfigRequest) (string, string) {
	if len(strings.TrimSpace(req.CompanyCode)) > 120 {
		return "companyCode", "companyCode must be at most 120 characters"
	}
	if len(strings.TrimSpace(req.CompanyName)) > 200 {
		return "companyName", "companyName must be at most 200 characters"
	}
	if req.PriorityMode != "" && !isPriorityMode(req.PriorityMode) {
		return "priorityMode", "priorityMode is not supported"
	}
	if req.InterviewDate != nil && strings.TrimSpace(*req.InterviewDate) != "" {
		if _, err := time.Parse(time.DateOnly, strings.TrimSpace(*req.InterviewDate)); err != nil {
			return "interviewDate", "interviewDate must be YYYY-MM-DD or null"
		}
	}
	return "", ""
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
