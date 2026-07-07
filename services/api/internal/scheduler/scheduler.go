// Package scheduler decides when a reviewed item should next be shown.
//
// The interface is stateless-friendly: implementers compute a Decision from
// a Rating and (optionally) the previous SchedulerState.  Stateless
// schedulers (e.g. Simple) ignore the state argument; stateful ones (e.g. FSRS)
// use it to produce algorithmically correct intervals.
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

// Decision is the scheduler's output for a single review.  All fields are
// populated so the caller can persist them directly into review_schedules
// without additional computation.
type Decision struct {
	IntervalDays   float64
	NextReviewAt   time.Time
	Stability      float64
	Difficulty     float64
	Ease           float64
	State          int8 // 0=New, 1=Learning, 2=Review, 3=Relearning
	Lapses         int
	LastRating     string
	RemainingSteps int
}

// SchedulerState captures the FSRS-relevant fields of an existing
// review_schedule row.  It is fed back into the scheduler via NextWithState
// so that stateful algorithms (FSRS) can produce correct decisions.
type SchedulerState struct {
	Stability     float64
	Difficulty    float64
	Ease          float64
	ScheduledDays uint64
	Reps          uint64
	Lapses        uint64
	State         int8
	LastReview    time.Time
	Due           time.Time
}

// Scheduler computes the next review time for a given rating.
type Scheduler interface {
	// Next computes the decision for a brand-new item (no prior state).
	Next(rating Rating, now time.Time) (Decision, error)

	// NextWithState computes the decision for an item that already has
	// review history.  Stateless implementations may ignore the state.
	NextWithState(state SchedulerState, rating Rating, now time.Time) (Decision, error)
}

// Simple is a fixed-interval scheduler (hard → 1 d, normal → 3 d, easy → 7 d).
// It ignores any prior SchedulerState.
type Simple struct{}

// NewSimple returns the fixed-interval scheduler.
func NewSimple() Simple { return Simple{} }

var simpleIntervals = map[Rating]float64{
	RatingHard:   1,
	RatingNormal: 3,
	RatingEasy:   7,
}

func (Simple) Next(rating Rating, now time.Time) (Decision, error) {
	return Simple{}.NextWithState(SchedulerState{}, rating, now)
}

func (Simple) NextWithState(_ SchedulerState, rating Rating, now time.Time) (Decision, error) {
	days, ok := simpleIntervals[rating]
	if !ok {
		return Decision{}, ErrInvalidRating
	}
	return Decision{
		IntervalDays: days,
		NextReviewAt: now.Add(time.Duration(days * float64(24*time.Hour))),
		State:        0, // New
		Ease:         2.5,
		LastRating:   string(rating),
	}, nil
}

// Ensure Simple satisfies Scheduler.
var _ Scheduler = Simple{}
