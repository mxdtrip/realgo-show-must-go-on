package scheduler

import (
	"fmt"
	"time"

	"github.com/open-spaced-repetition/go-fsrs/v3"
)

// FSRSAdapter implements Scheduler over go-fsrs/v3, using the same algorithm
// as the review service so that extension ingest and cabinet reviews share one
// scheduling model (issue #160).
type FSRSAdapter struct {
	fsrs *fsrs.FSRS
}

// NewFromConfig builds an FSRS scheduler from the operator-facing Config. It
// starts from DefaultParam (which recomputes the internal Decay/Factor
// coefficients and seeds the default 19 weights) and then applies only the
// user-tunable knobs. Weights are intentionally not exposed here: per-user
// optimization is a separate milestone (see fsrs audit, C1).
func NewFromConfig(cfg Config) *FSRSAdapter {
	param := fsrs.DefaultParam()
	if cfg.RequestRetention > 0 {
		param.RequestRetention = cfg.RequestRetention
	}
	if cfg.MaximumInterval > 0 {
		param.MaximumInterval = float64(cfg.MaximumInterval)
	}
	param.EnableShortTerm = cfg.EnableShortTerm
	param.EnableFuzz = cfg.EnableFuzz
	return &FSRSAdapter{fsrs: fsrs.NewFSRS(param)}
}

// NewFSRSAdapter builds an adapter with default FSRS parameters. It is kept as
// a shorthand for NewFromConfig(DefaultConfig()) so existing call sites and
// tests do not have to construct a Config explicitly.
func NewFSRSAdapter() *FSRSAdapter {
	return NewFromConfig(DefaultConfig())
}

// Next computes a decision for a brand-new card (State=New, no prior history).
// FSRS initialises S0/D0 on the first rating.
func (a *FSRSAdapter) Next(rating Rating, now time.Time) (Decision, error) {
	return a.NextWithState(SchedulerState{}, rating, now)
}

// NextWithState computes a decision for a card with prior FSRS history.
// An empty state is treated as a new card.
func (a *FSRSAdapter) NextWithState(state SchedulerState, rating Rating, now time.Time) (Decision, error) {
	fsrsRating, err := toFSRSRating(rating)
	if err != nil {
		return Decision{}, err
	}

	card := stateToCard(state, now)
	info := a.fsrs.Next(card, now, fsrsRating)
	return cardToDecision(info.Card, rating, now), nil
}

// toFSRSRating maps the public Rating enum to fsrs.Rating, mirroring
// review_service.toFsrsRating so both paths agree on semantics.
func toFSRSRating(rating Rating) (fsrs.Rating, error) {
	switch rating {
	case RatingHard:
		return fsrs.Hard, nil
	case RatingNormal:
		return fsrs.Good, nil
	case RatingEasy:
		return fsrs.Easy, nil
	default:
		return 0, fmt.Errorf("%w: %q", ErrInvalidRating, rating)
	}
}

// stateToCard rebuilds an fsrs.Card from a stored SchedulerState. A zero-value
// state yields a fresh New card, which FSRS uses to compute initial S0/D0.
func stateToCard(state SchedulerState, now time.Time) fsrs.Card {
	if state == (SchedulerState{}) {
		return fsrs.NewCard()
	}
	lastReview := state.LastReview
	if lastReview.IsZero() {
		lastReview = state.Due
	}
	return fsrs.Card{
		Due:           state.Due,
		Stability:     state.Stability,
		Difficulty:    state.Difficulty,
		ScheduledDays: state.ScheduledDays,
		Reps:          state.Reps,
		Lapses:        state.Lapses,
		State:         fsrs.State(state.State),
		LastReview:    lastReview,
	}
}

// cardToDecision maps an FSRS-updated card back to a scheduler Decision,
// mirroring review_service.applyCard so persisted values stay consistent.
func cardToDecision(card fsrs.Card, rating Rating, now time.Time) Decision {
	intervalDays := float64(card.ScheduledDays)
	if intervalDays < 0 {
		intervalDays = 0
	}
	return Decision{
		IntervalDays:   intervalDays,
		NextReviewAt:   card.Due,
		Stability:      card.Stability,
		Difficulty:     card.Difficulty,
		Ease:           2.5, // FSRS does not use ease; kept for schema compat
		State:          int8(card.State),
		Reps:           int(card.Reps),
		Lapses:         int(card.Lapses),
		LastRating:     string(rating),
		RemainingSteps: 0, // FSRS v3 short-term steps are not tracked here
	}
}

// Ensure FSRSAdapter satisfies Scheduler.
var _ Scheduler = (*FSRSAdapter)(nil)
