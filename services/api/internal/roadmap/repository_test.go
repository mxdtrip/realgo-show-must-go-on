package roadmap

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mxdtrip/freeburger/services/api/internal/patterns"
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

func subpattern(code string, familyProblemCount, solved int, masteryPercent int) patterns.AtlasSubpattern {
	return patterns.AtlasSubpattern{
		Code: code,
		Name: code,
		Stats: patterns.SubpatternStats{
			ProblemCount: familyProblemCount,
			SolvedCount:  solved,
		},
		Mastery: patterns.Mastery{Percent: masteryPercent},
	}
}

func TestBuildResponse_EmptyAtlas(t *testing.T) {
	resp := buildResponse(Target{}, patterns.AtlasResponse{})

	if resp.OverallProgress != 0 {
		t.Fatalf("overallProgress = %d, want 0", resp.OverallProgress)
	}
	if resp.Weeks == nil {
		t.Fatal("weeks must be an empty array, not null")
	}
	if len(resp.Weeks) != 0 {
		t.Fatalf("weeks = %v, want none", resp.Weeks)
	}
}

func TestBuildResponse_GroupsSubpatternsByFamilyAndRollsUpProgress(t *testing.T) {
	atlas := patterns.AtlasResponse{
		Families: []patterns.AtlasFamily{
			{Code: "arrays_hashing", Name: "Arrays & Hashing", Description: "frequency and grouping", Position: 1, SubpatternCodes: []string{"frequency_map", "grouping"}},
			{Code: "two_pointers", Name: "Two Pointers", Position: 2, SubpatternCodes: []string{"opposite_ends"}},
		},
		Subpatterns: []patterns.AtlasSubpattern{
			subpattern("frequency_map", 4, 4, 100),
			subpattern("grouping", 4, 0, 0),
			subpattern("opposite_ends", 2, 0, 0),
		},
	}

	resp := buildResponse(Target{}, atlas)

	if len(resp.Weeks) != 2 {
		t.Fatalf("weeks = %d, want 2", len(resp.Weeks))
	}

	first := resp.Weeks[0]
	if first.Title != "Arrays & Hashing" || first.Focus != "frequency and grouping" {
		t.Fatalf("unexpected first week: %+v", first)
	}
	// 4 solved out of 8 total across the family's two subpatterns.
	if first.Progress != 50 {
		t.Fatalf("first.progress = %d, want 50", first.Progress)
	}
	if first.Status != "active" {
		t.Fatalf("first.status = %q, want active", first.Status)
	}

	second := resp.Weeks[1]
	if second.Progress != 0 || second.Status != "todo" {
		t.Fatalf("unexpected second week: %+v", second)
	}

	// 4 solved out of 10 total problems across the whole atlas.
	if resp.OverallProgress != 40 {
		t.Fatalf("overallProgress = %d, want 40", resp.OverallProgress)
	}
}

func TestBuildResponse_WeekTopicIsWeakestSubpatternInFamily(t *testing.T) {
	atlas := patterns.AtlasResponse{
		Families: []patterns.AtlasFamily{
			{Code: "arrays_hashing", Name: "Arrays & Hashing", Position: 1, SubpatternCodes: []string{"strong_one", "weak_one"}},
		},
		Subpatterns: []patterns.AtlasSubpattern{
			subpattern("strong_one", 4, 4, 100),
			subpattern("weak_one", 4, 1, 25),
		},
	}

	resp := buildResponse(Target{}, atlas)

	if len(resp.Weeks) != 1 || len(resp.Weeks[0].Topics) != 1 {
		t.Fatalf("unexpected week topics: %+v", resp.Weeks)
	}
	if resp.Weeks[0].Topics[0] != "weak_one" {
		t.Fatalf("topics[0] = %q, want weak_one (lowest mastery)", resp.Weeks[0].Topics[0])
	}
}

func TestBuildResponse_FamiliesOrderedByPositionRegardlessOfInputOrder(t *testing.T) {
	atlas := patterns.AtlasResponse{
		Families: []patterns.AtlasFamily{
			{Code: "later", Name: "Later Week", Position: 5},
			{Code: "earlier", Name: "Earlier Week", Position: 1},
		},
	}

	resp := buildResponse(Target{}, atlas)

	if len(resp.Weeks) != 2 {
		t.Fatalf("weeks = %d, want 2", len(resp.Weeks))
	}
	if resp.Weeks[0].Title != "Earlier Week" || resp.Weeks[1].Title != "Later Week" {
		t.Fatalf("weeks not sorted by position: %+v", resp.Weeks)
	}
	if resp.Weeks[0].ID != "week_01" || resp.Weeks[1].ID != "week_02" {
		t.Fatalf("unexpected week ids: %+v", resp.Weeks)
	}
}

func TestBuildResponse_FamilyWithNoKnownSubpatternsHasNoTopics(t *testing.T) {
	atlas := patterns.AtlasResponse{
		Families: []patterns.AtlasFamily{
			{Code: "empty_family", Name: "Empty Family", Position: 1, SubpatternCodes: []string{"missing_code"}},
		},
	}

	resp := buildResponse(Target{}, atlas)

	if len(resp.Weeks) != 1 {
		t.Fatalf("weeks = %d, want 1", len(resp.Weeks))
	}
	if resp.Weeks[0].Topics == nil || len(resp.Weeks[0].Topics) != 0 {
		t.Fatalf("topics = %v, want empty slice", resp.Weeks[0].Topics)
	}
}
