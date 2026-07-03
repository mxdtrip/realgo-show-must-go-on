// Package ai exposes placeholder endpoints for AI-assisted content generation.
// Actual generation requires an AI provider (e.g. OpenAI) configured in config.
// Until then the endpoints log the intent to ai_request_logs and return 202 Accepted.
package ai

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/httpjson"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

type repository interface {
	CreateAIRequestLog(ctx context.Context, userID int64, feature string) (int64, error)
}

type Handler struct {
	repo repository
}

func NewHandler(repo repository) *Handler {
	return &Handler{repo: repo}
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

// GenerateCard handles POST /me/cards/generate.
func (h *Handler) GenerateCard(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	var req GenerateCardRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}
	if msg := validateTarget(req.ProblemID, req.PatternID); msg != "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", msg)
		return
	}

	id, err := h.repo.CreateAIRequestLog(r.Context(), userID, "card_generation")
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not queue generation request")
		return
	}

	response.JSON(w, http.StatusAccepted, map[string]any{
		"request_id": id,
		"status":     "queued",
		"message":    "AI card generation is not yet available; configure an AI provider to enable this feature.",
	})
}

// GenerateQuiz handles POST /me/quiz/generate.
func (h *Handler) GenerateQuiz(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	var req GenerateQuizRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}
	if msg := validateTarget(req.ProblemID, req.PatternID); msg != "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", msg)
		return
	}

	id, err := h.repo.CreateAIRequestLog(r.Context(), userID, "quiz_generation")
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not queue generation request")
		return
	}

	response.JSON(w, http.StatusAccepted, map[string]any{
		"request_id": id,
		"status":     "queued",
		"message":    "AI quiz generation is not yet available; configure an AI provider to enable this feature.",
	})
}
