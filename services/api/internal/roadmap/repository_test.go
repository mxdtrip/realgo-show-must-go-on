package roadmap

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

func TestTargetFromRow_IncludesCompanyAndInterviewDate(t *testing.T) {
	interviewAt := time.Date(2026, 7, 21, 10, 0, 0, 0, time.UTC)
	target := targetFromRow(db.GetRoadmapUserTargetRow{
		TargetCompany: pgtype.Text{String: "Google", Valid: true},
		InterviewDate: pgtype.Timestamptz{Time: interviewAt, Valid: true},
		TargetTopics:  []string{"arrays"},
	})

	if target.Company == nil {
		t.Fatal("company must not be nil for a stored name")
	}
	if target.Company.Code == nil || *target.Company.Code != "cmp_google" {
		t.Fatalf("company.code = %v, want cmp_google", target.Company.Code)
	}
	if target.Company.Name != "Google" {
		t.Fatalf("company.name = %q, want Google", target.Company.Name)
	}
	if target.InterviewDate == nil || *target.InterviewDate != "2026-07-21" {
		t.Fatalf("interviewDate = %v, want 2026-07-21", target.InterviewDate)
	}
	if len(target.Topics) != 1 || target.Topics[0] != "arrays" {
		t.Fatalf("topics = %v, want [arrays]", target.Topics)
	}
}

func TestTargetFromRow_UnknownCompanyHasNullCode(t *testing.T) {
	target := targetFromRow(db.GetRoadmapUserTargetRow{
		TargetCompany: pgtype.Text{String: "Acme", Valid: true},
	})

	if target.Company == nil {
		t.Fatal("company must not be nil when a name is stored")
	}
	if target.Company.Code != nil {
		t.Fatalf("company.code = %v, want nil for unknown company", target.Company.Code)
	}
	if target.Company.Name != "Acme" {
		t.Fatalf("company.name = %q, want Acme", target.Company.Name)
	}
}

func TestTargetFromRow_EmptyCompanyIsNull(t *testing.T) {
	target := targetFromRow(db.GetRoadmapUserTargetRow{
		TargetCompany: pgtype.Text{Valid: false},
	})

	if target.Company != nil {
		t.Fatalf("company = %v, want nil when no target_company is stored", target.Company)
	}
}

func TestTargetFromRow_EmptyTopicsDefaultsToEmptySlice(t *testing.T) {
	target := targetFromRow(db.GetRoadmapUserTargetRow{
		TargetTopics: nil,
	})

	if target.Topics == nil {
		t.Fatal("topics must be an empty slice, not nil, to serialise as [] in JSON")
	}
	if len(target.Topics) != 0 {
		t.Fatalf("topics = %v, want []", target.Topics)
	}
}

func TestBuildResponse_EmptyAccount(t *testing.T) {
	resp := buildResponse(Target{}, nil)

	if resp.OverallProgress != 0 {
		t.Fatalf("overallProgress = %d, want 0", resp.OverallProgress)
	}
	if resp.Weeks == nil {
		t.Fatal("weeks must be an empty array, not null")
	}
	if resp.Patterns == nil {
		t.Fatal("patterns must be an empty array, not null")
	}
}

func TestBuildResponse_AppliesUserProgressByPattern(t *testing.T) {
	resp := buildResponse(Target{}, []roadmapItem{
		{Position: 1, PatternCode: "arrays_hashing", PatternName: "Arrays & Hashing", ProblemID: 1, Title: "Contains Duplicate", Status: "reviewing", Difficulty: "easy"},
		{Position: 2, PatternCode: "arrays_hashing", PatternName: "Arrays & Hashing", ProblemID: 2, Title: "Two Sum", Status: "in_progress", Difficulty: "easy"},
		{Position: 3, PatternCode: "two_pointers", PatternName: "Two Pointers", ProblemID: 3, Title: "Valid Palindrome", Status: "not_started", Difficulty: "easy"},
	})

	if resp.OverallProgress != 33 {
		t.Fatalf("overallProgress = %d, want 33", resp.OverallProgress)
	}
	if len(resp.Patterns) != 2 {
		t.Fatalf("patterns = %d, want 2", len(resp.Patterns))
	}

	first := resp.Patterns[0]
	if first.TotalProblems != 2 || first.SolvedProblems != 1 || first.InProgressProblems != 1 || first.Progress != 50 {
		t.Fatalf("unexpected first pattern counters: %+v", first)
	}
	if first.Problems[0].Status != "reviewing" || first.Problems[1].Status != "in_progress" {
		t.Fatalf("unexpected problem statuses: %+v", first.Problems)
	}
	if resp.Weeks[0].Status != "active" || resp.Weeks[1].Status != "todo" {
		t.Fatalf("unexpected week statuses: %+v", resp.Weeks)
	}
}

func TestBuildResponse_DefaultsMissingStatusToNotStarted(t *testing.T) {
	resp := buildResponse(Target{}, []roadmapItem{
		{Position: 1, PatternCode: "stack", PatternName: "Stack", ProblemID: 1, Title: "Valid Parentheses"},
	})

	if got := resp.Patterns[0].Problems[0].Status; got != "not_started" {
		t.Fatalf("status = %q, want not_started", got)
	}
}
