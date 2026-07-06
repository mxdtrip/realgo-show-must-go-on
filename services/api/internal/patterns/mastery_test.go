package patterns

import "testing"

func TestComputeMasteryStatuses(t *testing.T) {
	cases := []struct {
		name  string
		stats SubpatternStats
		want  string
	}{
		{"untouched", SubpatternStats{ProblemCount: 10}, MasteryNotStarted},
		{"no problems linked, no activity", SubpatternStats{}, MasteryNotStarted},
		{"just started", SubpatternStats{ProblemCount: 10, SolvedCount: 1}, MasteryLearning},
		{"in progress only", SubpatternStats{ProblemCount: 10, InProgressCount: 2}, MasteryLearning},
		{"hard dominates", SubpatternStats{ProblemCount: 10, SolvedCount: 6, AttemptCount: 10, HardCount: 5}, MasteryWeak},
		{"some hard ratings", SubpatternStats{ProblemCount: 10, SolvedCount: 6, AttemptCount: 10, HardCount: 2}, MasteryUnstable},
		{"due reviews pending", SubpatternStats{ProblemCount: 10, SolvedCount: 6, DueCount: 2}, MasteryUnstable},
		{"solid but not full", SubpatternStats{ProblemCount: 10, SolvedCount: 6, AttemptCount: 10, HardCount: 0}, MasteryStrong},
		{"fully retained", SubpatternStats{ProblemCount: 10, SolvedCount: 9, AttemptCount: 20, HardCount: 1}, MasteryMastered},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := computeMastery(tc.stats)
			if got.Status != tc.want {
				t.Fatalf("status = %q, want %q (mastery %+v)", got.Status, tc.want, got)
			}
		})
	}
}

func TestComputeMasteryPercent(t *testing.T) {
	// No attempts: percent is pure practice share.
	m := computeMastery(SubpatternStats{ProblemCount: 4, SolvedCount: 2})
	if m.Percent != 50 || m.Components.Practice != 50 {
		t.Fatalf("practice-only percent = %d (components %+v), want 50", m.Percent, m.Components)
	}

	// With attempts: 60/40 blend of practice and retention.
	m = computeMastery(SubpatternStats{ProblemCount: 10, SolvedCount: 5, AttemptCount: 10, HardCount: 5})
	if m.Components.Practice != 50 || m.Components.Retention != 50 {
		t.Fatalf("components = %+v, want practice 50 / retention 50", m.Components)
	}
	if m.Percent != 50 {
		t.Fatalf("percent = %d, want 50", m.Percent)
	}

	// Not started always reports 0.
	if got := computeMastery(SubpatternStats{ProblemCount: 12}); got.Percent != 0 {
		t.Fatalf("not_started percent = %d, want 0", got.Percent)
	}
}

func TestComputeCoverage(t *testing.T) {
	rel := func(level string) *CompanyRelevance {
		return &CompanyRelevance{Relevance: level, Confidence: "medium", EvidenceCount: 3, SourceType: "demo"}
	}
	subpatterns := []AtlasSubpattern{
		{Code: "a", Name: "A", Relevance: rel("high"), Mastery: Mastery{Status: MasteryWeak, Percent: 20}},
		{Code: "b", Name: "B", Relevance: rel("medium"), Mastery: Mastery{Status: MasteryStrong, Percent: 80}},
		{Code: "c", Name: "C", Relevance: rel("low"), Mastery: Mastery{Status: MasteryNotStarted, Percent: 0}},
		{Code: "d", Name: "D", Relevance: rel("insufficient_evidence"), Mastery: Mastery{Status: MasteryWeak, Percent: 10}},
		{Code: "e", Name: "E"}, // no relevance at all
	}

	coverage := computeCoverage(subpatterns)

	if coverage.RelevantSubpatterns != 3 {
		t.Fatalf("relevant = %d, want 3 (insufficient_evidence and unrated excluded)", coverage.RelevantSubpatterns)
	}
	if coverage.Strong != 1 || coverage.Weak != 1 || coverage.NotStarted != 1 {
		t.Fatalf("buckets = %+v", coverage)
	}
	if len(coverage.TopGaps) != 2 {
		t.Fatalf("top gaps = %d, want 2", len(coverage.TopGaps))
	}
	// high×(100-20)=240 outranks low×(100-0)=100.
	if coverage.TopGaps[0].Code != "a" {
		t.Fatalf("top gap = %q, want a", coverage.TopGaps[0].Code)
	}
}
