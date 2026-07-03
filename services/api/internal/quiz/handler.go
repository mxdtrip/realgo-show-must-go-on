package quiz

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/request"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

const (
	defaultSessionLimit = 10
	maxSessionLimit     = 30
)

type repository interface {
	ListQuizSession(ctx context.Context, userID int64, limit int32) ([]sessionQuestion, error)
	GetQuizQuestion(ctx context.Context, questionID, userID int64) (questionDetail, error)
}

type Handler struct {
	repo repository
}

func NewHandler(repo repository) *Handler {
	return &Handler{repo: repo}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/session", h.session)
	r.Post("/{questionId}/answer", h.answer)
}

// GET /me/quiz/session
func (h *Handler) session(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	rows, err := h.repo.ListQuizSession(r.Context(), userID, sessionLimit(r))
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load quiz session")
		return
	}

	items := make([]questionItem, 0, len(rows))
	for _, q := range rows {
		items = append(items, questionItemFromSessionQuestion(q))
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"questions": items,
		"total":     len(items),
	})
}

// POST /me/quiz/{questionId}/answer
func (h *Handler) answer(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	questionID, err := strconv.ParseInt(chi.URLParam(r, "questionId"), 10, 64)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid questionId")
		return
	}

	var req answerRequest
	if !request.DecodeJSON(w, r, &req) {
		return
	}

	detail, err := h.repo.GetQuizQuestion(r.Context(), questionID, userID)
	if errors.Is(err, errNotFound) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "question not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not fetch question")
		return
	}

	response.JSON(w, http.StatusOK, answerResult{
		Correct:       req.Option == detail.CorrectOption,
		CorrectOption: detail.CorrectOption,
		Explanation:   detail.Explanation,
	})
}

func sessionLimit(r *http.Request) int32 {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		return defaultSessionLimit
	}
	if limit > maxSessionLimit {
		return maxSessionLimit
	}
	return int32(limit)
}
