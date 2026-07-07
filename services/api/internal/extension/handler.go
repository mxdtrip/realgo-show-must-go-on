package extension

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

const maxEventBodyBytes = 1 << 20

type Handler struct {
	pool *pgxpool.Pool
}

type eventRequest struct {
	Platform         string `json:"platform"`
	TaskTitle        string `json:"taskTitle"`
	TaskURL          string `json:"taskUrl"`
	PlatformTaskSlug string `json:"platformTaskSlug,omitempty"`
	SubmitResult     string `json:"submitResult,omitempty"`
	SubmittedAt      string `json:"submittedAt"`
	UserDifficulty   string `json:"userDifficulty"`
	CanSolveAgain    string `json:"canSolveAgain"`
}

type eventResponse struct {
	ProblemID      int64     `json:"problemId"`
	IdempotencyKey string    `json:"idempotencyKey"`
	NextReviewAt   time.Time `json:"nextReviewAt"`
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

func (h *Handler) CreateEvent(w http.ResponseWriter, r *http.Request) {
	if h == nil || h.pool == nil {
		response.Fail(w, http.StatusServiceUnavailable, "extension_unavailable", "extension service is not configured")
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req eventRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxEventBodyBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		response.Fail(w, http.StatusBadRequest, "validation_error", "request body is not valid JSON")
		return
	}
	req.normalize()
	if err := req.validate(); err != nil {
		response.Fail(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	eventTime, err := req.eventTime()
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "validation_error", "submittedAt must be an ISO 8601 timestamp")
		return
	}

	result, err := h.save(r.Context(), userID, req, eventTime)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not save extension event")
		return
	}
	response.JSON(w, http.StatusCreated, result)
}

func (req *eventRequest) normalize() {
	req.Platform = strings.ToLower(strings.TrimSpace(req.Platform))
	req.TaskTitle = strings.TrimSpace(req.TaskTitle)
	req.TaskURL = strings.TrimSpace(req.TaskURL)
	req.PlatformTaskSlug = strings.TrimSpace(req.PlatformTaskSlug)
	req.SubmitResult = strings.ToLower(strings.TrimSpace(req.SubmitResult))
	req.UserDifficulty = strings.ToLower(strings.TrimSpace(req.UserDifficulty))
	req.CanSolveAgain = strings.ToLower(strings.TrimSpace(req.CanSolveAgain))
}

func (req eventRequest) validate() error {
	if req.Platform == "" {
		req.Platform = "unknown"
	}
	switch req.Platform {
	case "leetcode", "neetcode", "unknown":
	default:
		return errors.New("platform must be leetcode, neetcode or unknown")
	}
	if req.TaskTitle == "" {
		return errors.New("taskTitle is required")
	}
	if req.TaskURL == "" {
		return errors.New("taskUrl is required")
	}
	parsedURL, err := url.ParseRequestURI(req.TaskURL)
	if err != nil || parsedURL.Host == "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return errors.New("taskUrl must be an absolute http or https URL")
	}
	switch req.UserDifficulty {
	case "hard", "normal", "easy":
	default:
		return errors.New("userDifficulty must be hard, normal or easy")
	}
	switch req.CanSolveAgain {
	case "no", "probably", "yes":
	default:
		return errors.New("canSolveAgain must be no, probably or yes")
	}
	return nil
}

func (req eventRequest) eventTime() (time.Time, error) {
	if req.SubmittedAt == "" {
		return time.Now().UTC(), nil
	}
	t, err := time.Parse(time.RFC3339, req.SubmittedAt)
	if err != nil {
		return time.Time{}, err
	}
	return t.UTC(), nil
}

func (h *Handler) save(ctx context.Context, userID int64, req eventRequest, eventTime time.Time) (eventResponse, error) {
	rawPayload, err := json.Marshal(req)
	if err != nil {
		return eventResponse{}, err
	}
	key := idempotencyKey(userID, req, eventTime)
	nextReviewAt, intervalDays := scheduleFor(req.UserDifficulty, eventTime)

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return eventResponse{}, err
	}
	defer tx.Rollback(ctx)

	platformID, err := platformID(ctx, tx, platformCode(req.Platform))
	if err != nil {
		return eventResponse{}, err
	}
	problemID, err := upsertProblem(ctx, tx, userID, platformID, req)
	if err != nil {
		return eventResponse{}, err
	}
	if err := upsertProgress(ctx, tx, userID, problemID, req, eventTime); err != nil {
		return eventResponse{}, err
	}
	if err := upsertSchedule(ctx, tx, userID, problemID, req.UserDifficulty, nextReviewAt, intervalDays, eventTime); err != nil {
		return eventResponse{}, err
	}
	if err := insertExtensionEvent(ctx, tx, userID, platformID, problemID, req, eventTime, key, rawPayload); err != nil {
		return eventResponse{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return eventResponse{}, err
	}

	return eventResponse{ProblemID: problemID, IdempotencyKey: key, NextReviewAt: nextReviewAt}, nil
}

type queryer interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}

func platformCode(code string) string {
	if code == "unknown" || code == "" {
		return "generic"
	}
	return code
}

func platformID(ctx context.Context, q queryer, code string) (int64, error) {
	var id int64
	err := q.QueryRow(ctx, `SELECT id FROM platforms WHERE code = $1`, code).Scan(&id)
	return id, err
}

func upsertProblem(ctx context.Context, q queryer, userID, platformID int64, req eventRequest) (int64, error) {
	slug := req.PlatformTaskSlug
	if slug == "" {
		slug = fallbackSlug(req)
	}

	var id int64
	err := q.QueryRow(ctx, `
		INSERT INTO problems (platform_id, external_slug, title, url, source_type, created_by_user_id)
		VALUES ($1, $2, $3, $4, 'extension', $5)
		ON CONFLICT (platform_id, external_slug) DO UPDATE SET
			title = EXCLUDED.title,
			url = EXCLUDED.url,
			source_type = EXCLUDED.source_type,
			updated_at = CURRENT_TIMESTAMP
		RETURNING id
	`, platformID, slug, req.TaskTitle, req.TaskURL, userID).Scan(&id)
	return id, err
}

func upsertProgress(ctx context.Context, q queryer, userID, problemID int64, req eventRequest, eventTime time.Time) error {
	status := "reviewing"
	var solvedAt any
	if req.SubmitResult == "accepted" {
		solvedAt = eventTime
	}
	_, err := q.Exec(ctx, `
		INSERT INTO user_problem_progress (
			user_id, problem_id, status, rating, first_seen_at, solved_at, last_reviewed_at, confidence
		)
		VALUES ($1, $2, $3, $4, $5, $6, $5, $7)
		ON CONFLICT (user_id, problem_id) DO UPDATE SET
			status = EXCLUDED.status,
			rating = EXCLUDED.rating,
			solved_at = COALESCE(user_problem_progress.solved_at, EXCLUDED.solved_at),
			last_reviewed_at = EXCLUDED.last_reviewed_at,
			confidence = EXCLUDED.confidence
	`, userID, problemID, status, req.UserDifficulty, eventTime, solvedAt, confidence(req.UserDifficulty))
	return err
}

func upsertSchedule(ctx context.Context, q queryer, userID, problemID int64, rating string, nextReviewAt time.Time, intervalDays float64, reviewedAt time.Time) error {
	var scheduleID int64
	err := q.QueryRow(ctx, `
		SELECT id
		FROM review_schedules
		WHERE user_id = $1 AND problem_id = $2
		ORDER BY id ASC
		LIMIT 1
		FOR UPDATE
	`, userID, problemID).Scan(&scheduleID)
	if errors.Is(err, pgx.ErrNoRows) {
		_, err = q.Exec(ctx, `
			INSERT INTO review_schedules (
				user_id, problem_id, next_review_at, interval_days, ease, stability, difficulty,
				review_count, last_rating, algorithm, last_review_at, state, lapses, remaining_steps
			)
			VALUES ($1, $2, $3, $4, 2.5, 1, 5, 0, $5, 'mvp-extension-v1', $6, 0, 0, 0)
		`, userID, problemID, nextReviewAt, intervalDays, rating, reviewedAt)
		return err
	}
	if err != nil {
		return err
	}
	_, err = q.Exec(ctx, `
		UPDATE review_schedules
		SET next_review_at = $2,
		    interval_days = $3,
		    last_rating = $4,
		    algorithm = 'mvp-extension-v1',
		    last_review_at = $5,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, scheduleID, nextReviewAt, intervalDays, rating, reviewedAt)
	return err
}

func insertExtensionEvent(ctx context.Context, q queryer, userID, platformID, problemID int64, req eventRequest, eventTime time.Time, key string, rawPayload []byte) error {
	eventType := "problem_submitted"
	if req.SubmitResult == "accepted" {
		eventType = "problem_solved"
	}
	_, err := q.Exec(ctx, `
		INSERT INTO extension_events (
			user_id, platform_id, url, external_slug, title, event_type, rating,
			extension_version, event_time, idempotency_key, raw_payload
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10)
		ON CONFLICT (idempotency_key) DO NOTHING
	`, userID, platformID, req.TaskURL, nullableString(req.PlatformTaskSlug), req.TaskTitle, eventType, req.UserDifficulty, eventTime, key, rawPayload)
	if err != nil {
		return err
	}
	_ = problemID
	return nil
}

func scheduleFor(rating string, t time.Time) (time.Time, float64) {
	switch rating {
	case "hard":
		return t.Add(6 * time.Hour), 0.25
	case "easy":
		return t.Add(7 * 24 * time.Hour), 7
	default:
		return t.Add(3 * 24 * time.Hour), 3
	}
}

func confidence(rating string) int {
	switch rating {
	case "easy":
		return 90
	case "normal":
		return 60
	default:
		return 30
	}
}

func idempotencyKey(userID int64, req eventRequest, eventTime time.Time) string {
	h := sha256.New()
	h.Write([]byte(req.Platform))
	h.Write([]byte{0})
	h.Write([]byte(req.PlatformTaskSlug))
	h.Write([]byte{0})
	h.Write([]byte(req.TaskURL))
	h.Write([]byte{0})
	h.Write([]byte(eventTime.Format(time.RFC3339Nano)))
	h.Write([]byte{0})
	h.Write([]byte(req.UserDifficulty))
	h.Write([]byte{0})
	h.Write([]byte(req.CanSolveAgain))
	h.Write([]byte{0})
	h.Write([]byte(strconv.FormatInt(userID, 10)))
	return hex.EncodeToString(h.Sum(nil))
}

func fallbackSlug(req eventRequest) string {
	if parsed, err := url.Parse(req.TaskURL); err == nil {
		parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
		if len(parts) > 0 && parts[len(parts)-1] != "" {
			return parts[len(parts)-1]
		}
	}
	sum := sha256.Sum256([]byte(req.TaskURL + "\x00" + req.TaskTitle))
	return "extension-" + hex.EncodeToString(sum[:8])
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}
