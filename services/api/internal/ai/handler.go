// Package ai exposes AI-assisted content generation endpoints. POST
// /me/cards/generate is backed by a real Provisioner once an AI provider is
// configured (see config.AI); POST /me/quiz/generate is still a placeholder
// that only logs the intent to ai_request_logs and returns 202 Accepted.
package ai

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/httpjson"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

type repository interface {
	CreateAIRequestLog(ctx context.Context, userID int64, feature string) (int64, error)
}

// CardGenerator is the behaviour Handler needs to serve POST
// /me/cards/generate. Satisfied by *Provisioner; nil disables the route
// (e.g. no AI provider key configured).
type CardGenerator interface {
	Ensure(ctx context.Context, problemID int64) (string, error)
}

type Handler struct {
	repo repository
	gen  CardGenerator
}

func NewHandler(repo repository, gen CardGenerator) *Handler {
	return &Handler{repo: repo, gen: gen}
}

func RegisterCardRoutes(r chi.Router, h *Handler) {
	r.Post("/generate", h.GenerateCard)
}

func RegisterQuizRoutes(r chi.Router, h *Handler) {
	r.Post("/generate", h.GenerateQuiz)
}

// validateTarget returns a non-empty message when the problem/pattern XOR rule is violated.
func validateTarget(problemID, patternID *int64) string {
	if problemID == nil && patternID == nil {
		return "problem_id or pattern_id is required"
	}
	if problemID != nil && patternID != nil {
		return "only one of problem_id or pattern_id may be set"
	}
	return ""
}

// GenerateCard handles POST /me/cards/generate: manually ensures the three
// global AI cards for a problem are ready, kicking off generation if they
// aren't (without blocking on the LLM call itself — see Provisioner.Ensure).
//
// 200 {"status": "ready"}      - cards already exist (cache, seed, or a
//
//	prior generation at the current prompt version).
//
// 202 {"status": "generating"} - generation just started or was already in
//
//	flight; poll GET /me/problems/{id}/cards for
//	the result.
//
// 404 when problem_id does not exist. 503 when no AI provider is configured.
func (h *Handler) GenerateCard(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("ai: GenerateCard failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	var req GenerateCardRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		slog.Warn("ai: GenerateCard failed", slog.Int64("user_id", userID))
		return
	}
	if msg := validateTarget(req.ProblemID, req.PatternID); msg != "" {
		slog.Warn("ai: GenerateCard failed", slog.Int64("user_id", userID), slog.String("reason", msg))
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", msg)
		return
	}
	if req.PatternID != nil {
		slog.Warn("ai: GenerateCard failed", slog.Int64("user_id", userID), slog.String("reason", "pattern_id not supported"))
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "AI card generation only supports problem_id targets")
		return
	}

	if h.gen == nil {
		response.Fail(w, http.StatusServiceUnavailable, "AI_UNAVAILABLE", "AI card generation is not configured")
		return
	}

	status, err := h.gen.Ensure(r.Context(), *req.ProblemID)
	if errors.Is(err, ErrProblemNotFound) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "problem not found")
		return
	}
	if err != nil {
		slog.Error("ai: GenerateCard failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not generate cards")
		return
	}

	httpStatus := http.StatusAccepted
	if status == EnsureReady {
		httpStatus = http.StatusOK
	}
	response.JSON(w, httpStatus, map[string]any{"status": status})
}

// GenerateQuiz handles POST /me/quiz/generate.
func (h *Handler) GenerateQuiz(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("ai: GenerateQuiz failed")
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	var req GenerateQuizRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		slog.Warn("ai: GenerateQuiz failed", slog.Int64("user_id", userID))
		return
	}
	if msg := validateTarget(req.ProblemID, req.PatternID); msg != "" {
		slog.Warn("ai: GenerateQuiz failed", slog.Int64("user_id", userID), slog.String("reason", msg))
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", msg)
		return
	}

	id, err := h.repo.CreateAIRequestLog(r.Context(), userID, "quiz_generation")
	if err != nil {
		slog.Error("ai: GenerateQuiz failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not queue generation request")
		return
	}

	response.JSON(w, http.StatusAccepted, map[string]any{
		"request_id": id,
		"status":     "queued",
		"message":    "AI quiz generation is not yet available; configure an AI provider to enable this feature.",
	})
}
