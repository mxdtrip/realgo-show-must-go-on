package roadmap

import "testing"

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
