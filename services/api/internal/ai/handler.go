// Package ai exposes stub endpoints for AI-assisted content generation.
// Actual generation requires an AI provider (e.g. OpenAI) to be configured.
// Currently the endpoints log the request to ai_request_logs and return 202
// so the client knows the feature exists but is pending provider setup.
package ai

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

func pgText(s string) pgtype.Text { return pgtype.Text{String: s, Valid: true} }

type Handler struct {
	q *db.Queries
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{q: db.New(pool)}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Post("/cards/generate", h.generateCard)
	r.Post("/quiz/generate", h.generateQuiz)
}

// generateCardRequest describes the context for card generation.
type generateCardRequest struct {
	// One of problem_id or pattern_id must be set.
	ProblemID *int64 `json:"problem_id"`
	PatternID *int64 `json:"pattern_id"`
	// Optional hint for the type of card to generate.
	CardType string `json:"card_type"`
}

// generateQuizRequest describes the context for quiz question generation.
type generateQuizRequest struct {
	ProblemID  *int64 `json:"problem_id"`
	PatternID  *int64 `json:"pattern_id"`
	Difficulty string `json:"difficulty"`
}

// POST /me/cards/generate
func (h *Handler) generateCard(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	var req generateCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.ProblemID == nil && req.PatternID == nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "problem_id or pattern_id is required")
		return
	}
	if req.ProblemID != nil && req.PatternID != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "only one of problem_id or pattern_id may be set")
		return
	}

	log, err := h.q.CreateAIRequestLog(r.Context(), db.CreateAIRequestLogParams{
		UserID:  userID,
		Feature: pgText("card_generation"),
	})
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not queue generation request")
		return
	}

	response.JSON(w, http.StatusAccepted, map[string]any{
		"request_id": log.ID,
		"status":     "queued",
		"message":    "AI card generation is not yet available; configure an AI provider to enable this feature.",
	})
}

// POST /me/quiz/generate
func (h *Handler) generateQuiz(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	var req generateQuizRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.ProblemID == nil && req.PatternID == nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "problem_id or pattern_id is required")
		return
	}
	if req.ProblemID != nil && req.PatternID != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "only one of problem_id or pattern_id may be set")
		return
	}

	log, err := h.q.CreateAIRequestLog(r.Context(), db.CreateAIRequestLogParams{
		UserID:  userID,
		Feature: pgText("quiz_generation"),
	})
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not queue generation request")
		return
	}

	response.JSON(w, http.StatusAccepted, map[string]any{
		"request_id": log.ID,
		"status":     "queued",
		"message":    "AI quiz generation is not yet available; configure an AI provider to enable this feature.",
	})
}
