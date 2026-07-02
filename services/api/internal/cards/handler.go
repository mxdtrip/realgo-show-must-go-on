package cards

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	v1response "github.com/mxdtrip/freeburger/services/api/internal/controller/v1/response"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
	"github.com/mxdtrip/freeburger/services/api/internal/service"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

const (
	defaultCardsLimit  = 20
	maxCardsLimit      = 50
	defaultSessionLimit = 20
)

// reviewRater is the narrow slice of service.ReviewService this handler needs.
type reviewRater interface {
	RateReview(ctx context.Context, reviewID, userID int64, rating string, reviewedAt time.Time) (v1response.RateReviewData, error)
}

type Handler struct {
	q         *db.Queries
	reviewSvc reviewRater
}

func NewHandler(pool *pgxpool.Pool, reviewSvc service.ReviewService) *Handler {
	return &Handler{q: db.New(pool), reviewSvc: reviewSvc}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/", h.list)
	r.Get("/session", h.session)
	r.Post("/{cardId}/rate", h.rate)
}

// --- response types ---

type scheduleInfo struct {
	ScheduleID   int64   `json:"schedule_id"`
	NextReviewAt *string `json:"next_review_at"`
	LastRating   *string `json:"last_rating"`
	ReviewCount  int     `json:"review_count"`
	State        string  `json:"state"`
}

type cardItem struct {
	ID           int64         `json:"id"`
	Type         string        `json:"type"`
	Question     string        `json:"question"`
	Answer       string        `json:"answer"`
	Explanation  *string       `json:"explanation"`
	Source       *string       `json:"source"`
	CreatedByAI  bool          `json:"created_by_ai"`
	CreatedAt    string        `json:"created_at"`
	ProblemTitle *string       `json:"problem_title"`
	ProblemURL   *string       `json:"problem_url"`
	PatternName  *string       `json:"pattern_name"`
	Schedule     *scheduleInfo `json:"schedule"`
}

type sessionCard struct {
	ScheduleID   int64   `json:"schedule_id"`
	CardID       int64   `json:"card_id"`
	Type         string  `json:"type"`
	Question     string  `json:"question"`
	Answer       string  `json:"answer"`
	Explanation  *string `json:"explanation"`
	ProblemTitle *string `json:"problem_title"`
	ProblemURL   *string `json:"problem_url"`
	PatternName  *string `json:"pattern_name"`
	NextReviewAt string  `json:"next_review_at"`
	LastRating   *string `json:"last_rating"`
	ReviewCount  int     `json:"review_count"`
	State        string  `json:"state"`
}

type rateRequest struct {
	Rating     string `json:"rating"`
	ReviewedAt string `json:"reviewed_at"`
}

// --- handlers ---

// GET /me/cards
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	limit := cardsLimit(r)
	rows, err := h.q.ListUserCards(r.Context(), db.ListUserCardsParams{Column1: userID, Column2: limit})
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load cards")
		return
	}

	items := make([]cardItem, 0, len(rows))
	for _, row := range rows {
		item := cardItem{
			ID:          row.ID,
			Type:        row.Type,
			Question:    row.Question,
			Answer:      row.Answer,
			CreatedByAI: row.CreatedByAi.Bool,
		}
		if row.CreatedAt.Valid {
			item.CreatedAt = row.CreatedAt.Time.UTC().Format(time.RFC3339)
		}
		if row.Explanation.Valid {
			item.Explanation = &row.Explanation.String
		}
		if row.Source.Valid {
			item.Source = &row.Source.String
		}
		if row.ProblemTitle.Valid {
			item.ProblemTitle = &row.ProblemTitle.String
		}
		if row.ProblemUrl.Valid {
			item.ProblemURL = &row.ProblemUrl.String
		}
		if row.PatternName.Valid {
			item.PatternName = &row.PatternName.String
		}
		if row.ScheduleID.Valid {
			sched := &scheduleInfo{
				ScheduleID:  row.ScheduleID.Int64,
				ReviewCount: int(row.ReviewCount),
				State:       fsrsState(int(row.State.Int16)),
			}
			if row.NextReviewAt.Valid {
				t := row.NextReviewAt.Time.UTC().Format(time.RFC3339)
				sched.NextReviewAt = &t
			}
			if row.LastRating.Valid {
				sched.LastRating = &row.LastRating.String
			}
			item.Schedule = sched
		}
		items = append(items, item)
	}

	response.JSON(w, http.StatusOK, map[string][]cardItem{"cards": items})
}

// GET /me/cards/session
func (h *Handler) session(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	rows, err := h.q.ListDueCardSessions(r.Context(), db.ListDueCardSessionsParams{
		Column1: userID,
		Column2: defaultSessionLimit,
	})
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load card session")
		return
	}

	items := make([]sessionCard, 0, len(rows))
	for _, row := range rows {
		item := sessionCard{
			ScheduleID:  row.ScheduleID,
			CardID:      row.CardID,
			Type:        row.Type,
			Question:    row.Question,
			Answer:      row.Answer,
			ReviewCount: int(row.ReviewCount),
			State:       fsrsState(int(row.State)),
		}
		if row.NextReviewAt.Valid {
			item.NextReviewAt = row.NextReviewAt.Time.UTC().Format(time.RFC3339)
		}
		if row.Explanation.Valid {
			item.Explanation = &row.Explanation.String
		}
		if row.ProblemTitle.Valid {
			item.ProblemTitle = &row.ProblemTitle.String
		}
		if row.ProblemUrl.Valid {
			item.ProblemURL = &row.ProblemUrl.String
		}
		if row.PatternName.Valid {
			item.PatternName = &row.PatternName.String
		}
		if row.LastRating.Valid {
			item.LastRating = &row.LastRating.String
		}
		items = append(items, item)
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"cards": items,
		"total": len(items),
	})
}

// POST /me/cards/{cardId}/rate
func (h *Handler) rate(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	cardID, err := strconv.ParseInt(chi.URLParam(r, "cardId"), 10, 64)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid cardId")
		return
	}

	var req rateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if !validRating(req.Rating) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "rating must be hard, normal, or easy")
		return
	}
	reviewedAt, err := time.Parse(time.RFC3339, req.ReviewedAt)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "reviewed_at must be RFC3339")
		return
	}

	// Look up the review schedule for this card.
	scheduleID, err := h.q.GetCardScheduleForUser(r.Context(), db.GetCardScheduleForUserParams{
		Column1: cardID,
		Column2: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "card or schedule not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not find card schedule")
		return
	}

	// Advance the review schedule using existing FSRS logic.
	data, err := h.reviewSvc.RateReview(r.Context(), scheduleID, userID, req.Rating, reviewedAt)
	if errors.Is(err, service.ErrReviewNotFound) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "review schedule not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not rate card")
		return
	}

	response.JSON(w, http.StatusOK, data)
}

// --- helpers ---

func cardsLimit(r *http.Request) int32 {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		return defaultCardsLimit
	}
	if limit > maxCardsLimit {
		return maxCardsLimit
	}
	return int32(limit)
}

func validRating(r string) bool {
	return r == "hard" || r == "normal" || r == "easy"
}

// fsrsState maps FSRS numeric state to a readable string.
func fsrsState(state int) string {
	switch state {
	case 1:
		return "learning"
	case 2:
		return "review"
	case 3:
		return "relearning"
	default:
		return "new"
	}
}
