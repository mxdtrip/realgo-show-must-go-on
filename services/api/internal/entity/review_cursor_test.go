package entity_test

import (
	"testing"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/entity"
)

func TestReviewQueueCursor_RoundTrip(t *testing.T) {
	want := entity.ReviewQueueCursor{
		NextReviewAt: time.Date(2026, 7, 4, 10, 30, 0, 0, time.UTC),
		ID:           42,
	}

	encoded, err := entity.EncodeReviewQueueCursor(want)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if encoded == "" {
		t.Fatal("expected non-empty encoded cursor")
	}

	got, err := entity.DecodeReviewQueueCursor(encoded)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !got.NextReviewAt.Equal(want.NextReviewAt) {
		t.Errorf("NextReviewAt = %v, want %v", got.NextReviewAt, want.NextReviewAt)
	}
	if got.ID != want.ID {
		t.Errorf("ID = %d, want %d", got.ID, want.ID)
	}
}

func TestDecodeReviewQueueCursor_InvalidBase64(t *testing.T) {
	if _, err := entity.DecodeReviewQueueCursor("not-valid-base64!!!"); err != entity.ErrInvalidReviewQueueCursor {
		t.Errorf("expected ErrInvalidReviewQueueCursor, got %v", err)
	}
}

func TestDecodeReviewQueueCursor_InvalidJSON(t *testing.T) {
	// Valid base64url, but not JSON.
	if _, err := entity.DecodeReviewQueueCursor("bm90LWpzb24"); err != entity.ErrInvalidReviewQueueCursor {
		t.Errorf("expected ErrInvalidReviewQueueCursor, got %v", err)
	}
}

func TestDecodeReviewQueueCursor_NonPositiveID(t *testing.T) {
	encoded, err := entity.EncodeReviewQueueCursor(entity.ReviewQueueCursor{NextReviewAt: time.Now(), ID: 0})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := entity.DecodeReviewQueueCursor(encoded); err != entity.ErrInvalidReviewQueueCursor {
		t.Errorf("expected ErrInvalidReviewQueueCursor, got %v", err)
	}
}

func TestFirstReviewQueueCursor_IsZeroValue(t *testing.T) {
	cursor := entity.FirstReviewQueueCursor()
	if !cursor.NextReviewAt.IsZero() {
		t.Errorf("expected zero-value NextReviewAt, got %v", cursor.NextReviewAt)
	}
	if cursor.ID != 0 {
		t.Errorf("expected ID 0, got %d", cursor.ID)
	}
}
