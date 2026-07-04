package scheduler_test

import (
	"errors"
	"testing"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/scheduler"
)

func TestSimple_Next_FixedIntervals(t *testing.T) {
	now := time.Date(2026, 6, 30, 12, 0, 0, 0, time.UTC)
	s := scheduler.NewSimple()

	cases := []struct {
		rating   scheduler.Rating
		wantDays float64
	}{
		{scheduler.RatingHard, 1},
		{scheduler.RatingNormal, 3},
		{scheduler.RatingEasy, 7},
	}

	for _, c := range cases {
		got, err := s.Next(c.rating, now)
		if err != nil {
			t.Fatalf("Next(%q): unexpected error: %v", c.rating, err)
		}
		if got.IntervalDays != c.wantDays {
			t.Errorf("Next(%q).IntervalDays = %v, want %v", c.rating, got.IntervalDays, c.wantDays)
		}
		want := now.Add(time.Duration(c.wantDays) * 24 * time.Hour)
		if !got.NextReviewAt.Equal(want) {
			t.Errorf("Next(%q).NextReviewAt = %v, want %v", c.rating, got.NextReviewAt, want)
		}
	}
}

func TestSimple_Next_InvalidRating(t *testing.T) {
	_, err := scheduler.NewSimple().Next("medium", time.Now())
	if !errors.Is(err, scheduler.ErrInvalidRating) {
		t.Fatalf("expected ErrInvalidRating, got %v", err)
	}
}

func TestSimple_Next_IsRelativeToNow(t *testing.T) {
	s := scheduler.NewSimple()
	a := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	b := a.Add(48 * time.Hour)

	da, _ := s.Next(scheduler.RatingEasy, a)
	db, _ := s.Next(scheduler.RatingEasy, b)

	if !db.NextReviewAt.Equal(da.NextReviewAt.Add(48 * time.Hour)) {
		t.Errorf("next review should shift with now: got %v and %v", da.NextReviewAt, db.NextReviewAt)
	}
}
