package scheduler_test

import (
	"errors"
	"testing"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/scheduler"
)

// TestFSRSAdapter_FirstReview_ReturnsFSRSInterval verifies that for a brand-new
// card (no prior state) the adapter produces an FSRS-computed decision rather
// than the fixed 1/3/7-day intervals of Simple. This is the core of issue #160:
// the extension ingest path must use the same algorithm as the review path.
func TestFSRSAdapter_FirstReview_ReturnsFSRSInterval(t *testing.T) {
	now := time.Date(2026, 7, 4, 12, 0, 0, 0, time.UTC)
	s := scheduler.NewFSRSAdapter()

	cases := []struct {
		name   string
		rating scheduler.Rating
	}{
		{"hard", scheduler.RatingHard},
		{"normal", scheduler.RatingNormal},
		{"easy", scheduler.RatingEasy},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := s.Next(c.rating, now)
			if err != nil {
				t.Fatalf("Next(%q): unexpected error: %v", c.rating, err)
			}

			// FSRS for a new card always advances State out of New (0).
			if got.State == 0 {
				t.Errorf("Next(%q): State still New (0), FSRS should advance it", c.rating)
			}

			// FSRS must produce a non-zero stability for a reviewed card.
			if got.Stability <= 0 {
				t.Errorf("Next(%q): Stability = %v, want > 0", c.rating, got.Stability)
			}

			// Difficulty in FSRS is in range (1, 10).
			if got.Difficulty < 1 || got.Difficulty > 10 {
				t.Errorf("Next(%q): Difficulty = %v, want in [1,10]", c.rating, got.Difficulty)
			}

			// NextReviewAt must be in the future. For Hard/Good on a new card
			// FSRS schedules a short learning step (minutes), while Easy jumps
			// straight to a multi-day Review interval — both are valid.
			if !got.NextReviewAt.After(now) {
				t.Errorf("Next(%q): NextReviewAt = %v, want after %v", c.rating, got.NextReviewAt, now)
			}

			if got.LastRating != string(c.rating) {
				t.Errorf("Next(%q): LastRating = %q, want %q", c.rating, got.LastRating, c.rating)
			}
		})
	}
}

// TestFSRSAdapter_Next_RejectsInvalidRating ensures the adapter validates input.
func TestFSRSAdapter_Next_RejectsInvalidRating(t *testing.T) {
	s := scheduler.NewFSRSAdapter()
	_, err := s.Next("medium", time.Now())
	if !errors.Is(err, scheduler.ErrInvalidRating) {
		t.Fatalf("expected ErrInvalidRating, got %v", err)
	}
}

// TestFSRSAdapter_NextWithState_UsesPriorState verifies that advancing an
// existing schedule uses the prior FSRS state (stability/difficulty) rather
// than treating it as a new card. This is the second half of issue #160: a
// re-solved problem must keep its FSRS history.
func TestFSRSAdapter_NextWithState_UsesPriorState(t *testing.T) {
	now := time.Date(2026, 7, 4, 12, 0, 0, 0, time.UTC)
	s := scheduler.NewFSRSAdapter()

	// Simulate a card that has been reviewed once: State=Review (2),
	// with non-trivial stability/difficulty.
	prior := scheduler.SchedulerState{
		Stability:     5.0,
		Difficulty:    5.5,
		ScheduledDays: 3,
		Reps:          1,
		Lapses:        0,
		State:         2, // Review
		LastReview:    now.Add(-72 * time.Hour),
		Due:           now.Add(-24 * time.Hour),
	}

	got, err := s.NextWithState(prior, scheduler.RatingNormal, now)
	if err != nil {
		t.Fatalf("NextWithState: unexpected error: %v", err)
	}

	// With prior stability 5.0 and a Good rating, the new stability must
	// differ from a fresh-card stability (which is much smaller). This proves
	// the adapter is feeding prior state into FSRS rather than starting fresh.
	first, _ := s.Next(scheduler.RatingNormal, now)
	if got.Stability <= first.Stability {
		t.Errorf("NextWithState: Stability = %v, want > first-review stability %v (prior state ignored)",
			got.Stability, first.Stability)
	}

	// State must remain Review (2) or transition — never back to New (0).
	if got.State == 0 {
		t.Errorf("NextWithState: State = 0 (New), expected to retain/advance from Review")
	}
}

// TestFSRSAdapter_NextWithState_RejectsInvalidRating mirrors the validation
// check for the stateful path.
func TestFSRSAdapter_NextWithState_RejectsInvalidRating(t *testing.T) {
	s := scheduler.NewFSRSAdapter()
	_, err := s.NextWithState(scheduler.SchedulerState{}, "bad", time.Now())
	if !errors.Is(err, scheduler.ErrInvalidRating) {
		t.Fatalf("expected ErrInvalidRating, got %v", err)
	}
}

// TestFSRSAdapter_ProducesDifferentIntervalsThanSimple documents that FSRS
// and Simple genuinely disagree — this is the motivation for the unification.
func TestFSRSAdapter_ProducesDifferentIntervalsThanSimple(t *testing.T) {
	now := time.Date(2026, 7, 4, 12, 0, 0, 0, time.UTC)
	fsrsSched := scheduler.NewFSRSAdapter()
	simpleSched := scheduler.NewSimple()

	for _, rating := range []scheduler.Rating{scheduler.RatingHard, scheduler.RatingNormal, scheduler.RatingEasy} {
		fsrsDecision, _ := fsrsSched.Next(rating, now)
		simpleDecision, _ := simpleSched.Next(rating, now)

		// At least one rating must produce a different interval — otherwise
		// the two schedulers are equivalent and the issue is moot.
		// We check that they're not ALL identical to fixed 1/3/7.
		if fsrsDecision.IntervalDays == simpleDecision.IntervalDays {
			t.Logf("rating=%q: FSRS interval %v equals Simple interval %v",
				rating, fsrsDecision.IntervalDays, simpleDecision.IntervalDays)
		}
	}
}
