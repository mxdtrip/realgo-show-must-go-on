package extension

import (
	"fmt"
	"strings"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/scheduler"
)

// Event types accepted from the extension. Only EventProblemSolved drives the
// progress + review-schedule flow; the rest are recorded for the activity feed.
const (
	EventProblemSolved = "problem_solved"
	EventProblemViewed = "problem_viewed"
	EventRatingChanged = "rating_changed"
)

// EventRequest is the POST /api/v1/extension/events payload.
type EventRequest struct {
	EventID          string       `json:"eventId"`
	Source           string       `json:"source"` // platform code, e.g. "leetcode"
	Event            string       `json:"event"`  // see Event* constants
	OccurredAt       string       `json:"occurredAt"`
	Rating           string       `json:"rating"` // hard | normal | easy (problem_solved)
	ExtensionVersion string       `json:"extensionVersion"`
	Problem          EventProblem `json:"problem"`
}

// EventProblem is the task the event refers to.
type EventProblem struct {
	ExternalID  string `json:"externalId"`
	Title       string `json:"title"`
	URL         string `json:"url"`
	Difficulty  string `json:"difficulty"`  // optional: easy | medium | hard
	PatternName string `json:"patternName"` // optional, unused in MVP
}

// EventResult is the response payload (problem_id, status, next_review_at per
// the issue's acceptance criteria, plus idempotency signal).
type EventResult struct {
	Accepted     bool       `json:"accepted"`
	Duplicate    bool       `json:"duplicate"`
	ProblemID    int64      `json:"problemId"`
	Status       string     `json:"status"`
	NextReviewAt *time.Time `json:"nextReviewAt"`
}

// normalized is the validated, lower-cased view of an EventRequest.
type normalized struct {
	eventID    string
	platform   string
	event      string
	slug       string
	title      string
	url        string
	difficulty string
	rating     scheduler.Rating
	solved     bool
	occurredAt time.Time
}

var validEventTypes = map[string]bool{
	EventProblemSolved: true,
	EventProblemViewed: true,
	EventRatingChanged: true,
}

var validDifficulty = map[string]bool{
	"easy":   true,
	"medium": true,
	"hard":   true,
}

// normalize validates the request and lower-cases platform + slug. The provided
// now is used when occurredAt is absent.
func (r EventRequest) normalize(now time.Time) (normalized, error) {
	out := normalized{
		eventID:    strings.TrimSpace(r.EventID),
		platform:   strings.ToLower(strings.TrimSpace(r.Source)),
		event:      strings.ToLower(strings.TrimSpace(r.Event)),
		slug:       strings.ToLower(strings.TrimSpace(r.Problem.ExternalID)),
		title:      strings.TrimSpace(r.Problem.Title),
		url:        strings.TrimSpace(r.Problem.URL),
		difficulty: strings.ToLower(strings.TrimSpace(r.Problem.Difficulty)),
	}

	if out.eventID == "" {
		return normalized{}, fmt.Errorf("%w: eventId is required", ErrValidation)
	}
	if out.platform == "" {
		return normalized{}, fmt.Errorf("%w: source is required", ErrValidation)
	}
	if !validEventTypes[out.event] {
		return normalized{}, fmt.Errorf("%w: unsupported event %q", ErrValidation, r.Event)
	}
	if out.slug == "" {
		return normalized{}, fmt.Errorf("%w: problem.externalId is required", ErrValidation)
	}
	if out.url == "" {
		return normalized{}, fmt.Errorf("%w: problem.url is required", ErrValidation)
	}
	if out.title == "" {
		out.title = out.slug
	}
	// problems.difficulty is constrained to easy|medium|hard; drop anything else
	// so the upsert stores NULL rather than violating the CHECK.
	if !validDifficulty[out.difficulty] {
		out.difficulty = ""
	}

	out.solved = out.event == EventProblemSolved
	if out.solved {
		rating := scheduler.Rating(strings.ToLower(strings.TrimSpace(r.Rating)))
		switch rating {
		case scheduler.RatingHard, scheduler.RatingNormal, scheduler.RatingEasy:
			out.rating = rating
		default:
			return normalized{}, fmt.Errorf("%w: rating must be hard, normal or easy for %s", ErrValidation, EventProblemSolved)
		}
	}

	if strings.TrimSpace(r.OccurredAt) == "" {
		out.occurredAt = now
	} else {
		ts, err := time.Parse(time.RFC3339, r.OccurredAt)
		if err != nil {
			return normalized{}, fmt.Errorf("%w: occurredAt must be ISO 8601", ErrValidation)
		}
		out.occurredAt = ts
	}

	return out, nil
}
