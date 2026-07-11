package extension

import (
	"context"
	"errors"
	"testing"
	"time"
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
	s := NewService(repo)
	s.now = func() time.Time { return now }
	return s
}

type fakeProvisioner struct {
	calls     int
	problemID int64
	platform  string
	slug      string
}

func (f *fakeProvisioner) ProvisionAsync(problemID int64, platform, slug string) {
	f.calls++
	f.problemID = problemID
	f.platform = platform
	f.slug = slug
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

func TestHandle_Solved_BuildsIngestInput(t *testing.T) {
	now := time.Date(2026, 6, 30, 9, 0, 0, 0, time.UTC)
	repo := &fakeRepo{
		platformID: 7,
		out: IngestOutput{
			ProblemID: 42,
			Status:    "reviewing",
		},
	}
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

	if !in.Solved {
		t.Error("Solved = false, want true")
	}

	if in.EventType != EventProblemSolved {
		t.Errorf("EventType = %q, want %q", in.EventType, EventProblemSolved)
	}

	if in.Rating != "easy" {
		t.Errorf("Rating = %q, want %q", in.Rating, "easy")
	}

	if !in.EventTime.Equal(now) {
		t.Errorf("EventTime = %v, want %v", in.EventTime, now)
	}

	if in.Slug != "two-sum" {
		t.Errorf("Slug = %q, want %q", in.Slug, "two-sum")
	}

	if in.PlatformID != 7 {
		t.Errorf("PlatformID = %d, want %d", in.PlatformID, 7)
	}

	if in.UserID != 100 {
		t.Errorf("UserID = %d, want %d", in.UserID, 100)
	}

	if in.Title != "Two Sum" {
		t.Errorf("Title = %q, want %q", in.Title, "Two Sum")
	}

	if in.URL != "https://leetcode.com/problems/two-sum/" {
		t.Errorf("URL = %q, want %q", in.URL, "https://leetcode.com/problems/two-sum/")
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

func TestHandle_Solved_TriggersProvisioner(t *testing.T) {
	now := time.Date(2026, 6, 30, 9, 0, 0, 0, time.UTC)
	repo := &fakeRepo{platformID: 7, out: IngestOutput{ProblemID: 42, Status: "reviewing"}}
	svc := newTestService(repo, now)
	provisioner := &fakeProvisioner{}
	svc.WithProvisioner(provisioner)

	if _, err := svc.Handle(context.Background(), 100, solvedRequest()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if provisioner.calls != 1 {
		t.Fatalf("provisioner calls = %d, want 1", provisioner.calls)
	}
	if provisioner.problemID != 42 || provisioner.platform != "leetcode" || provisioner.slug != "two-sum" {
		t.Errorf("unexpected provisioner args: problemID=%d platform=%q slug=%q", provisioner.problemID, provisioner.platform, provisioner.slug)
	}
}

func TestHandle_NonSolved_DoesNotTriggerProvisioner(t *testing.T) {
	now := time.Date(2026, 6, 30, 9, 0, 0, 0, time.UTC)
	repo := &fakeRepo{platformID: 3, out: IngestOutput{ProblemID: 9, Status: "saved"}}
	svc := newTestService(repo, now)
	provisioner := &fakeProvisioner{}
	svc.WithProvisioner(provisioner)

	req := solvedRequest()
	req.Event = "problem_viewed"
	req.Rating = ""
	if _, err := svc.Handle(context.Background(), 1, req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if provisioner.calls != 0 {
		t.Fatalf("provisioner calls = %d, want 0 for a non-solved event", provisioner.calls)
	}
}

func TestHandle_NilProvisioner_DoesNotPanic(t *testing.T) {
	now := time.Date(2026, 6, 30, 9, 0, 0, 0, time.UTC)
	repo := &fakeRepo{platformID: 7, out: IngestOutput{ProblemID: 42, Status: "reviewing"}}
	svc := newTestService(repo, now)

	if _, err := svc.Handle(context.Background(), 100, solvedRequest()); err != nil {
		t.Fatalf("unexpected error: %v", err)
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
	repo := &fakeRepo{
		platformID: 3,
		out: IngestOutput{
			ProblemID: 9,
			Status:    "saved",
		},
	}
	svc := newTestService(repo, now)

	req := solvedRequest()
	req.Event = "problem_viewed"
	req.Rating = ""

	res, err := svc.Handle(context.Background(), 1, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.Status != "saved" {
		t.Errorf("Status = %q, want %q", res.Status, "saved")
	}

	in := repo.lastIn

	if in.Solved {
		t.Error("Solved = true, want false")
	}

	if in.Rating != "" {
		t.Errorf("Rating = %q, want empty", in.Rating)
	}

	if in.EventType != EventProblemViewed {
		t.Errorf("EventType = %q, want %q", in.EventType, EventProblemViewed)
	}

	if !in.EventTime.Equal(now) {
		t.Errorf("EventTime = %v, want %v", in.EventTime, now)
	}
}

func TestHandle_SubmissionPayload_Accepted(t *testing.T) {
	now := time.Date(2026, 6, 30, 9, 0, 0, 0, time.UTC)
	submittedAt := now.Add(-15 * time.Minute)

	repo := &fakeRepo{
		platformID: 5,
		out: IngestOutput{
			ProblemID: 11,
			Status:    "reviewing",
		},
	}
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

	if in.PlatformID != 5 {
		t.Fatalf("PlatformID = %d, want 5", in.PlatformID)
	}

	if in.Slug != "two-sum" {
		t.Fatalf("Slug = %q, want %q", in.Slug, "two-sum")
	}

	if in.Title != "Two Sum" {
		t.Fatalf("Title = %q, want %q", in.Title, "Two Sum")
	}

	if in.Rating != "normal" {
		t.Fatalf("Rating = %q, want %q", in.Rating, "normal")
	}

	if !in.EventTime.Equal(submittedAt) {
		t.Fatalf("EventTime = %v, want %v", in.EventTime, submittedAt)
	}

	if in.IdempotencyKey == "" {
		t.Fatal("generated idempotency key must not be empty")
	}
}

func TestHandle_SubmissionPayload_NonAcceptedRecordsSubmittedOnly(t *testing.T) {
	now := time.Date(2026, 6, 30, 9, 0, 0, 0, time.UTC)
	repo := &fakeRepo{
		platformID: 5,
		out: IngestOutput{
			ProblemID: 12,
			Status:    "saved",
		},
	}
	svc := newTestService(repo, now)

	_, err := svc.Handle(context.Background(), 7, EventRequest{
		Platform:       "hackerrank",
		TaskTitle:      "Valid Parentheses",
		TaskURL:        "https://www.hackerrank.com/challenges/valid-parentheses/problem",
		SubmitResult:   "wrong_answer",
		SubmittedAt:    now.Format(time.RFC3339),
		UserDifficulty: "hard",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	in := repo.lastIn

	if in.Solved {
		t.Fatal("Solved = true, want false")
	}

	if in.EventType != EventProblemSubmitted {
		t.Fatalf("EventType = %q, want %q", in.EventType, EventProblemSubmitted)
	}

	if in.Rating != "hard" {
		t.Fatalf("Rating = %q, want %q", in.Rating, "hard")
	}

	if !in.EventTime.Equal(now) {
		t.Fatalf("EventTime = %v, want %v", in.EventTime, now)
	}

	if in.PlatformID != 5 {
		t.Fatalf("PlatformID = %d, want 5", in.PlatformID)
	}

	if in.Title != "Valid Parentheses" {
		t.Fatalf("Title = %q, want %q", in.Title, "Valid Parentheses")
	}
}
