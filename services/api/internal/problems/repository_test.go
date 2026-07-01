package problems

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

func TestProblemFromRowMapsNullableFields(t *testing.T) {
	createdAt := time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC)
	updatedAt := createdAt.Add(time.Hour)

	item := problemFromRow(db.ListUserProblemsRow{
		ID:           7,
		ExternalID:   "leetcode_two_sum",
		Title:        "Two Sum",
		Url:          "https://leetcode.com/problems/two-sum/",
		Platform:     "leetcode",
		Difficulty:   "unknown",
		Status:       "saved",
		NextReviewAt: pgtype.Timestamptz{},
		LastRating:   pgtype.Text{},
		SolvedAt:     pgtype.Timestamptz{},
		CreatedAt:    pgtype.Timestamptz{Time: createdAt, Valid: true},
		UpdatedAt:    pgtype.Timestamptz{Time: updatedAt, Valid: true},
	})

	if item.Pattern != nil {
		t.Fatalf("pattern = %#v, want nil", item.Pattern)
	}
	if item.NextReviewAt != nil || item.LastRating != nil || item.SolvedAt != nil {
		t.Fatalf("nullable fields must map to nil: %#v", item)
	}
	if !item.CreatedAt.Equal(createdAt) || !item.UpdatedAt.Equal(updatedAt) {
		t.Fatalf("timestamps were not mapped correctly: %#v", item)
	}
	if item.Difficulty != "unknown" {
		t.Fatalf("difficulty = %q, want unknown", item.Difficulty)
	}
}

func TestProblemFromRowMapsPatternAndReviewState(t *testing.T) {
	nextReviewAt := time.Date(2026, 7, 2, 9, 0, 0, 0, time.UTC)
	solvedAt := time.Date(2026, 6, 28, 20, 10, 0, 0, time.UTC)
	createdAt := solvedAt
	updatedAt := nextReviewAt

	item := problemFromRow(db.ListUserProblemsRow{
		ID:           8,
		ExternalID:   "leetcode_two_sum_ii",
		Title:        "Two Sum II",
		Url:          "https://leetcode.com/problems/two-sum-ii/",
		Platform:     "leetcode",
		Difficulty:   "medium",
		PatternID:    pgtype.Text{String: "two_pointers", Valid: true},
		PatternName:  pgtype.Text{String: "Two Pointers", Valid: true},
		Status:       "reviewing",
		NextReviewAt: pgtype.Timestamptz{Time: nextReviewAt, Valid: true},
		LastRating:   pgtype.Text{String: "normal", Valid: true},
		SolvedAt:     pgtype.Timestamptz{Time: solvedAt, Valid: true},
		CreatedAt:    pgtype.Timestamptz{Time: createdAt, Valid: true},
		UpdatedAt:    pgtype.Timestamptz{Time: updatedAt, Valid: true},
	})

	if item.Pattern == nil {
		t.Fatal("pattern must be present")
	}
	if item.Pattern.ID != "two_pointers" || item.Pattern.Name != "Two Pointers" {
		t.Fatalf("pattern = %#v", item.Pattern)
	}
	if item.NextReviewAt == nil || !item.NextReviewAt.Equal(nextReviewAt) {
		t.Fatalf("nextReviewAt = %#v, want %s", item.NextReviewAt, nextReviewAt)
	}
	if item.LastRating == nil || *item.LastRating != "normal" {
		t.Fatalf("lastRating = %#v, want normal", item.LastRating)
	}
	if item.SolvedAt == nil || !item.SolvedAt.Equal(solvedAt) {
		t.Fatalf("solvedAt = %#v, want %s", item.SolvedAt, solvedAt)
	}
}
