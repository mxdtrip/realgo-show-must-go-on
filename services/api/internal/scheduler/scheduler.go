// Package scheduler decides when a reviewed item should next be shown.
//
// The MVP uses fixed per-rating intervals (see Simple). The Scheduler interface
// is intentionally independent of any specific algorithm (e.g. FSRS) so the
// implementation can be swapped later without touching callers.
package scheduler

import (
	"errors"
	"time"
)

// Rating is the user's self-assessment of how a review went.
type Rating string

const (
	RatingHard   Rating = "hard"
	RatingNormal Rating = "normal"
	RatingEasy   Rating = "easy"
)

// ErrInvalidRating is returned for a rating outside hard/normal/easy.
var ErrInvalidRating = errors.New("scheduler: invalid rating, must be hard, normal or easy")

// Decision is the scheduler's output for a single review.
type Decision struct {
	// IntervalDays is the length of the next interval, in days.
	IntervalDays float64
	// NextReviewAt is when the item becomes due again.
	NextReviewAt time.Time
}

// Scheduler computes the next review time for a given rating.
// Implementations must not assume any particular algorithm.
type Scheduler interface {
	Next(rating Rating, now time.Time) (Decision, error)
}

// Simple is the MVP scheduler: a fixed interval per rating
// (hard → 1 day, normal → 3 days, easy → 7 days).
type Simple struct{}

// NewSimple returns the MVP fixed-interval scheduler.
func NewSimple() Simple { return Simple{} }

// simpleIntervals maps each rating to its fixed interval in days.
var simpleIntervals = map[Rating]float64{
	RatingHard:   1,
	RatingNormal: 3,
	RatingEasy:   7,
}

// Next returns the fixed interval for the rating; the item is due at now plus
// that interval. An unknown rating yields ErrInvalidRating.
func (Simple) Next(rating Rating, now time.Time) (Decision, error) {
	days, ok := simpleIntervals[rating]
	if !ok {
		return Decision{}, ErrInvalidRating
	}
	return Decision{
		IntervalDays: days,
		NextReviewAt: now.Add(time.Duration(days * float64(24*time.Hour))),
	}, nil
}

// Ensure Simple satisfies Scheduler.
var _ Scheduler = Simple{}
