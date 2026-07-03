package entity

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// ErrInvalidReviewQueueCursor is returned when a cursor query param cannot be decoded.
var ErrInvalidReviewQueueCursor = errors.New("invalid cursor")

// ReviewQueueCursor is the keyset pagination cursor for GET /me/reviews/queue,
// seeking forward on (next_review_at, id) ascending.
type ReviewQueueCursor struct {
	NextReviewAt time.Time
	ID           int64
}

// FirstReviewQueueCursor is the sentinel cursor for the first page: since the
// queue is ordered ascending and seeks with `>`, this must be less than any
// real (next_review_at, id) pair.
func FirstReviewQueueCursor() ReviewQueueCursor {
	return ReviewQueueCursor{}
}

type reviewQueueCursorPayload struct {
	NextReviewAt string `json:"nextReviewAt"`
	ID           int64  `json:"id"`
}

// EncodeReviewQueueCursor serializes a cursor to an opaque base64 string.
func EncodeReviewQueueCursor(cursor ReviewQueueCursor) string {
	payload := reviewQueueCursorPayload{
		NextReviewAt: cursor.NextReviewAt.UTC().Format(time.RFC3339Nano),
		ID:           cursor.ID,
	}
	raw, _ := json.Marshal(payload)
	return base64.RawURLEncoding.EncodeToString(raw)
}

// DecodeReviewQueueCursor parses a cursor produced by EncodeReviewQueueCursor.
func DecodeReviewQueueCursor(raw string) (ReviewQueueCursor, error) {
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return ReviewQueueCursor{}, ErrInvalidReviewQueueCursor
	}

	var payload reviewQueueCursorPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return ReviewQueueCursor{}, ErrInvalidReviewQueueCursor
	}
	if payload.ID <= 0 || strings.TrimSpace(payload.NextReviewAt) == "" {
		return ReviewQueueCursor{}, ErrInvalidReviewQueueCursor
	}

	nextReviewAt, err := time.Parse(time.RFC3339Nano, payload.NextReviewAt)
	if err != nil {
		return ReviewQueueCursor{}, ErrInvalidReviewQueueCursor
	}
	return ReviewQueueCursor{NextReviewAt: nextReviewAt, ID: payload.ID}, nil
}
