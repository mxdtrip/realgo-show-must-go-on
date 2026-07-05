package extension

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/scheduler"
)

// Provisioner triggers AI card generation for a solved problem. Optional:
// a nil Provisioner (the default) leaves generation disabled, e.g. when no
// AI provider key is configured.
type Provisioner interface {
	ProvisionAsync(problemID int64, platform, slug string)
}

// Service turns a validated extension event into stored problem/progress/review
// state. It is algorithm-agnostic: the scheduler decides the next review time.
type Service struct {
	repo        Repository
	sched       scheduler.Scheduler
	now         func() time.Time
	provisioner Provisioner
}

// NewService wires the repository and the review scheduler.
func NewService(repo Repository, sched scheduler.Scheduler) *Service {
	return &Service{repo: repo, sched: sched, now: time.Now}
}

// WithProvisioner enables AI card generation for solved problems.
func (s *Service) WithProvisioner(p Provisioner) *Service {
	s.provisioner = p
	return s
}

// Handle validates and persists one event for the authenticated user.
func (s *Service) Handle(ctx context.Context, userID int64, req EventRequest) (EventResult, error) {
	norm, err := req.normalize(s.now())
	if err != nil {
		return EventResult{}, err
	}

	platformID, err := s.repo.PlatformIDByCode(ctx, norm.platform)
	if err != nil {
		return EventResult{}, err
	}

	in := IngestInput{
		UserID:           userID,
		PlatformID:       platformID,
		Slug:             norm.slug,
		Title:            norm.title,
		URL:              norm.url,
		Difficulty:       norm.difficulty,
		EventType:        norm.event,
		ExtensionVersion: strings.TrimSpace(req.ExtensionVersion),
		EventTime:        norm.occurredAt,
		IdempotencyKey:   norm.eventID,
		RawPayload:       safeRawPayload(norm),
		Solved:           norm.solved,
	}

	if norm.rating != "" {
		in.Rating = string(norm.rating)
	}
	if norm.solved {
		decision, derr := s.sched.Next(norm.rating, norm.occurredAt)
		if derr != nil {
			return EventResult{}, derr
		}
		in.IntervalDays = decision.IntervalDays
		in.NextReviewAt = decision.NextReviewAt
	}

	out, err := s.repo.Ingest(ctx, in)
	if err != nil {
		return EventResult{}, err
	}

	if norm.solved && s.provisioner != nil {
		s.provisioner.ProvisionAsync(out.ProblemID, norm.platform, norm.slug)
	}

	return EventResult{
		Accepted:     true,
		Duplicate:    out.Duplicate,
		ProblemID:    out.ProblemID,
		ReviewID:     out.ReviewID,
		Status:       out.Status,
		NextReviewAt: out.NextReviewAt,
	}, nil
}

// safeRawPayload stores only our own normalized fields. Page content (HTML,
// problem conditions, editorials, premium material) is never persisted.
func safeRawPayload(n normalized) []byte {
	b, _ := json.Marshal(struct {
		EventID    string `json:"eventId"`
		Source     string `json:"source"`
		Event      string `json:"event"`
		Slug       string `json:"slug"`
		Title      string `json:"title"`
		URL        string `json:"url"`
		Difficulty string `json:"difficulty,omitempty"`
		Rating     string `json:"rating,omitempty"`
		OccurredAt string `json:"occurredAt"`
	}{
		EventID:    n.eventID,
		Source:     n.platform,
		Event:      n.event,
		Slug:       n.slug,
		Title:      n.title,
		URL:        n.url,
		Difficulty: n.difficulty,
		Rating:     string(n.rating),
		OccurredAt: n.occurredAt.UTC().Format(time.RFC3339),
	})
	return b
}
