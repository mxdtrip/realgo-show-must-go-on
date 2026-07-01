package problems

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

const (
	defaultListLimit = 50
	maxListLimit     = 100
)

var (
	errInvalidCursor = errors.New("invalid cursor")
	errInvalidLimit  = errors.New("limit must be a positive integer")
)

type Handler struct {
	repo repository
}

type repository interface {
	List(ctx context.Context, userID int64, params ListParams) ([]Problem, error)
}

func NewHandler(repo repository) *Handler {
	return &Handler{repo: repo}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/", h.List)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	params, pageLimit, err := parseListParams(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	items, err := h.repo.List(r.Context(), userID, params)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	body := buildListResponse(items, pageLimit)
	response.JSON(w, http.StatusOK, body)
}

func parseListParams(r *http.Request) (ListParams, int, error) {
	limit, err := parseLimit(r.URL.Query().Get("limit"))
	if err != nil {
		return ListParams{}, 0, err
	}

	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status != "" && !validStatus(status) {
		return ListParams{}, 0, errors.New("status must be one of saved, reviewing, mastered, archived")
	}

	platform := strings.TrimSpace(r.URL.Query().Get("platform"))
	if platform != "" && !validPlatform(platform) {
		return ListParams{}, 0, errors.New("platform must be one of leetcode, neetcode, codeforces, custom")
	}

	cursor := initialCursor()
	if raw := strings.TrimSpace(r.URL.Query().Get("cursor")); raw != "" {
		cursor, err = decodeCursor(raw)
		if err != nil {
			return ListParams{}, 0, err
		}
	}

	return ListParams{
		Limit:    int32(limit + 1),
		Status:   status,
		Platform: platform,
		Cursor:   cursor,
	}, limit, nil
}

func parseLimit(raw string) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return defaultListLimit, nil
	}
	limit, err := strconv.Atoi(raw)
	if err != nil || limit <= 0 {
		return 0, errInvalidLimit
	}
	if limit > maxListLimit {
		return maxListLimit, nil
	}
	return limit, nil
}

func buildListResponse(items []Problem, limit int) ListResponse {
	if items == nil {
		items = []Problem{}
	}

	var nextCursor *string
	if len(items) > limit {
		items = items[:limit]
		cursor := encodeCursor(Cursor{
			CreatedAt: items[len(items)-1].CreatedAt,
			ID:        items[len(items)-1].ID,
		})
		nextCursor = &cursor
	}

	return ListResponse{
		Data: items,
		Meta: ListMeta{NextCursor: nextCursor},
	}
}

func validStatus(status string) bool {
	switch status {
	case "saved", "reviewing", "mastered", "archived":
		return true
	default:
		return false
	}
}

func validPlatform(platform string) bool {
	switch platform {
	case "leetcode", "neetcode", "codeforces", "custom":
		return true
	default:
		return false
	}
}

type cursorPayload struct {
	CreatedAt string `json:"createdAt"`
	ID        int64  `json:"id"`
}

func initialCursor() Cursor {
	return Cursor{
		CreatedAt: time.Date(9999, 12, 31, 23, 59, 59, int(time.Second-time.Nanosecond), time.UTC),
		ID:        math.MaxInt64,
	}
}

func encodeCursor(cursor Cursor) string {
	payload := cursorPayload{
		CreatedAt: cursor.CreatedAt.UTC().Format(time.RFC3339Nano),
		ID:        cursor.ID,
	}
	raw, _ := json.Marshal(payload)
	return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeCursor(raw string) (Cursor, error) {
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return Cursor{}, errInvalidCursor
	}

	var payload cursorPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return Cursor{}, errInvalidCursor
	}
	if payload.ID <= 0 || strings.TrimSpace(payload.CreatedAt) == "" {
		return Cursor{}, errInvalidCursor
	}

	createdAt, err := time.Parse(time.RFC3339Nano, payload.CreatedAt)
	if err != nil {
		return Cursor{}, errInvalidCursor
	}
	return Cursor{CreatedAt: createdAt, ID: payload.ID}, nil
}
