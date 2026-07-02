package quiz

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

const (
	defaultSessionLimit = 10
	maxSessionLimit     = 30
)

type Handler struct {
	q *db.Queries
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{q: db.New(pool)}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/session", h.session)
	r.Post("/{questionId}/answer", h.answer)
}

// --- response types ---

type questionItem struct {
	ID           int64    `json:"id"`
	Question     string   `json:"question"`
	Options      []string `json:"options"`
	Difficulty   *string  `json:"difficulty"`
	CreatedByAI  bool     `json:"created_by_ai"`
	CreatedAt    string   `json:"created_at"`
	ProblemID    *int64   `json:"problem_id"`
	ProblemTitle *string  `json:"problem_title"`
	PatternID    *int64   `json:"pattern_id"`
	PatternName  *string  `json:"pattern_name"`
}

type answerRequest struct {
	Option int `json:"option"`
}

type answerResult struct {
	Correct       bool    `json:"correct"`
	CorrectOption int     `json:"correct_option"`
	Explanation   *string `json:"explanation"`
}

// GET /me/quiz/session
func (h *Handler) session(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	limit := sessionLimit(r)
	rows, err := h.q.ListQuizSession(r.Context(), db.ListQuizSessionParams{
		UserID:       userID,
		SessionLimit: limit,
	})
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load quiz session")
		return
	}

	items := make([]questionItem, 0, len(rows))
	for _, row := range rows {
		item := questionItem{
			ID:          row.ID,
			Question:    row.Question,
			CreatedByAI: row.CreatedByAi.Bool,
		}
		if row.CreatedAt.Valid {
			item.CreatedAt = row.CreatedAt.Time.UTC().Format(time.RFC3339)
		}
		if row.Difficulty.Valid {
			item.Difficulty = &row.Difficulty.String
		}
		if row.ProblemID.Valid {
			v := row.ProblemID.Int64
			item.ProblemID = &v
		}
		if row.ProblemTitle.Valid {
			item.ProblemTitle = &row.ProblemTitle.String
		}
		if row.PatternID.Valid {
			v := row.PatternID.Int64
			item.PatternID = &v
		}
		if row.PatternName.Valid {
			item.PatternName = &row.PatternName.String
		}
		// Unmarshal JSONB options without exposing correct_option.
		_ = json.Unmarshal(row.Options, &item.Options)
		if item.Options == nil {
			item.Options = []string{}
		}
		items = append(items, item)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}

	row, err := h.q.GetQuizQuestion(r.Context(), db.GetQuizQuestionParams{
		QuestionID: questionID,
		UserID:     userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "question not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not fetch question")
		return
	}

	result := answerResult{
		Correct:       req.Option == int(row.CorrectOption),
		CorrectOption: int(row.CorrectOption),
	}
	if row.Explanation.Valid {
		result.Explanation = &row.Explanation.String
	}

	response.JSON(w, http.StatusOK, result)
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
