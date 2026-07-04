package extension

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/scheduler"
)

type fakeRepo struct {
	platformID  int64
	platformErr error
	out         IngestOutput
	ingestErr   error

	calls  int
	lastIn IngestInput
}

func (f *fakeRepo) PlatformIDByCode(_ context.Context, _ string) (int64, error) {
	if f.platformErr != nil {
		return 0, f.platformErr
	}
	return f.platformID, nil
}

func (f *fakeRepo) Ingest(_ context.Context, in IngestInput) (IngestOutput, error) {
	f.calls++
	f.lastIn = in
	if f.ingestErr != nil {
		return IngestOutput{}, f.ingestErr
	}
	return f.out, nil
}

func newTestService(repo Repository, now time.Time) *Service {
	s := NewService(repo, scheduler.NewSimple())
	s.now = func() time.Time { return now }
	return s
}

func solvedRequest() EventRequest {
	return EventRequest{
		EventID: "evt_1",
		Source:  "LeetCode",
		Event:   "problem_solved",
		Rating:  "easy",
		Problem: EventProblem{ExternalID: "Two-Sum", Title: "Two Sum", URL: "https://leetcode.com/problems/two-sum/"},
	}
}

func TestHandle_Solved_PassesSchedulerDecision(t *testing.T) {
	now := time.Date(2026, 6, 30, 9, 0, 0, 0, time.UTC)
	repo := &fakeRepo{platformID: 7, out: IngestOutput{ProblemID: 42, Status: "reviewing"}}
	svc := newTestService(repo, now)

	res, err := svc.Handle(context.Background(), 100, solvedRequest())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Accepted || res.ProblemID != 42 || res.Status != "reviewing" {
		t.Fatalf("unexpected result: %+v", res)
	}
	if repo.calls != 1 {
		t.Fatalf("Ingest calls = %d, want 1", repo.calls)
	}
	in := repo.lastIn
	if !in.Solved || in.EventType != EventProblemSolved {
		t.Errorf("expected solved problem_solved, got solved=%v type=%q", in.Solved, in.EventType)
	}
	if in.Rating != "easy" || in.IntervalDays != 7 {
		t.Errorf("easy rating should give 7d interval, got rating=%q interval=%v", in.Rating, in.IntervalDays)
	}
	if !in.NextReviewAt.Equal(now.Add(7 * 24 * time.Hour)) {
		t.Errorf("nextReviewAt = %v, want %v", in.NextReviewAt, now.Add(7*24*time.Hour))
	}
	if in.Slug != "two-sum" || in.PlatformID != 7 {
		t.Errorf("normalization off: slug=%q platformID=%d", in.Slug, in.PlatformID)
	}
}

func TestHandle_MissingEventID_Validation(t *testing.T) {
	repo := &fakeRepo{platformID: 1}
	svc := newTestService(repo, time.Now())

	req := solvedRequest()
	req.EventID = ""
	_, err := svc.Handle(context.Background(), 1, req)
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation, got %v", err)
	}
	if repo.calls != 0 {
		t.Fatalf("repo must not be called on validation error, calls=%d", repo.calls)
	}
}

func TestHandle_SolvedWithoutRating_Validation(t *testing.T) {
	repo := &fakeRepo{platformID: 1}
	svc := newTestService(repo, time.Now())

	req := solvedRequest()
	req.Rating = ""
	_, err := svc.Handle(context.Background(), 1, req)
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation for solved without rating, got %v", err)
	}
}

func TestHandle_UnknownPlatform(t *testing.T) {
	repo := &fakeRepo{platformErr: ErrUnknownPlatform}
	svc := newTestService(repo, time.Now())

	_, err := svc.Handle(context.Background(), 1, solvedRequest())
	if !errors.Is(err, ErrUnknownPlatform) {
		t.Fatalf("expected ErrUnknownPlatform, got %v", err)
	}
}

func TestHandle_NonSolved_NoRatingNeeded(t *testing.T) {
	now := time.Date(2026, 6, 30, 9, 0, 0, 0, time.UTC)
	repo := &fakeRepo{platformID: 3, out: IngestOutput{ProblemID: 9, Status: "saved"}}
	svc := newTestService(repo, now)

	req := solvedRequest()
	req.Event = "problem_viewed"
	req.Rating = ""
	res, err := svc.Handle(context.Background(), 1, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Status != "saved" {
		t.Errorf("status = %q, want saved", res.Status)
	}
	if repo.lastIn.Solved || repo.lastIn.IntervalDays != 0 {
		t.Errorf("non-solved must not schedule: solved=%v interval=%v", repo.lastIn.Solved, repo.lastIn.IntervalDays)
	}
}

func TestHandle_SubmissionPayload_Accepted(t *testing.T) {
	now := time.Date(2026, 6, 30, 9, 0, 0, 0, time.UTC)
	submittedAt := now.Add(-15 * time.Minute)
	repo := &fakeRepo{platformID: 5, out: IngestOutput{ProblemID: 11, Status: "reviewing"}}
	svc := newTestService(repo, now)

	res, err := svc.Handle(context.Background(), 7, EventRequest{
		Platform:         "leetcode",
		TaskTitle:        "Two Sum",
		TaskURL:          "https://leetcode.com/problems/two-sum/",
		PlatformTaskSlug: "Two-Sum",
		SubmitResult:     "accepted",
		SubmittedAt:      submittedAt.Format(time.RFC3339),
		UserDifficulty:   "normal",
		CanSolveAgain:    "probably",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Accepted || res.Status != "reviewing" {
		t.Fatalf("unexpected result: %+v", res)
	}

	in := repo.lastIn
	if !in.Solved || in.EventType != EventProblemSolved {
		t.Fatalf("event type = %q solved=%v, want solved", in.EventType, in.Solved)
	}
	if in.PlatformID != 5 || in.Slug != "two-sum" || in.Title != "Two Sum" {
		t.Fatalf("normalization off: platform=%d slug=%q title=%q", in.PlatformID, in.Slug, in.Title)
	}
	if in.Rating != "normal" || in.IntervalDays != 3 {
		t.Fatalf("rating=%q interval=%v, want normal/3", in.Rating, in.IntervalDays)
	}
	if !in.EventTime.Equal(submittedAt) {
		t.Fatalf("event time = %v, want %v", in.EventTime, submittedAt)
	}
	if in.IdempotencyKey == "" {
		t.Fatal("generated idempotency key must not be empty")
	}
}

func TestHandle_SubmissionPayload_NonAcceptedRecordsSubmittedOnly(t *testing.T) {
	now := time.Date(2026, 6, 30, 9, 0, 0, 0, time.UTC)
	repo := &fakeRepo{platformID: 5, out: IngestOutput{ProblemID: 12, Status: "saved"}}
	svc := newTestService(repo, now)

	_, err := svc.Handle(context.Background(), 7, EventRequest{
		Platform:       "neetcode",
		TaskTitle:      "Valid Parentheses",
		TaskURL:        "https://neetcode.io/problems/valid-parentheses",
		SubmitResult:   "wrong_answer",
		SubmittedAt:    now.Format(time.RFC3339),
		UserDifficulty: "hard",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	in := repo.lastIn
	if in.Solved || in.EventType != EventProblemSubmitted {
		t.Fatalf("event type = %q solved=%v, want submitted only", in.EventType, in.Solved)
	}
	if in.IntervalDays != 0 || !in.NextReviewAt.IsZero() {
		t.Fatalf("non-accepted submit must not schedule: interval=%v next=%v", in.IntervalDays, in.NextReviewAt)
	}
	if in.Rating != "hard" {
		t.Fatalf("rating = %q, want hard", in.Rating)
	}
}
