package patterns

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

// Relevance levels ordered by how strongly they should pull attention.
var relevanceWeight = map[string]int{
	"high":   3,
	"medium": 2,
	"low":    1,
}

const topGapsLimit = 5

// GetAtlas assembles the full atlas in a fixed number of flat queries
// (taxonomy nodes, two edge sets, four per-user aggregate sets, plus two
// company queries when an overlay is requested).
func (r *pgRepository) GetAtlas(ctx context.Context, userID int64, companyCode string) (AtlasResponse, error) {
	nodes, err := r.q.ListTaxonomyNodes(ctx, pgtype.Text{String: TaxonomyVersion, Valid: true})
	if err != nil {
		return AtlasResponse{}, fmt.Errorf("atlas: list nodes: %w", err)
	}
	familyEdges, err := r.q.ListFamilySubpatternEdges(ctx)
	if err != nil {
		return AtlasResponse{}, fmt.Errorf("atlas: list family edges: %w", err)
	}
	prereqEdges, err := r.q.ListSubpatternPrerequisiteEdges(ctx)
	if err != nil {
		return AtlasResponse{}, fmt.Errorf("atlas: list prerequisite edges: %w", err)
	}
	stats, err := r.userSubpatternStats(ctx, userID)
	if err != nil {
		return AtlasResponse{}, err
	}

	relevanceByCode := map[string]CompanyRelevance{}
	var overlay *AtlasCompanyOverlay
	if companyCode != "" {
		companies, err := r.ListCompanies(ctx)
		if err != nil {
			return AtlasResponse{}, err
		}
		for _, company := range companies {
			if company.Code != companyCode {
				continue
			}
			overlay = &AtlasCompanyOverlay{Code: company.Code, Name: company.Name, DemoOnly: company.DemoOnly}
			break
		}
		if overlay == nil {
			return AtlasResponse{}, ErrCompanyNotFound
		}
		rows, err := r.q.ListCompanySubpatternRelevance(ctx, companyCode)
		if err != nil {
			return AtlasResponse{}, fmt.Errorf("atlas: list company relevance: %w", err)
		}
		for _, row := range rows {
			relevanceByCode[row.Code] = CompanyRelevance{
				Relevance:     row.Relevance,
				Confidence:    row.Confidence,
				EvidenceCount: int(row.EvidenceCount),
				LastSeenAt:    dateString(row.LastSeenAt),
				SourceType:    row.SourceType,
			}
		}
	}

	subpatternFamilies := map[string][]string{}
	familySubpatterns := map[string][]string{}
	for _, edge := range familyEdges {
		subpatternFamilies[edge.SubpatternCode] = append(subpatternFamilies[edge.SubpatternCode], edge.FamilyCode)
		familySubpatterns[edge.FamilyCode] = append(familySubpatterns[edge.FamilyCode], edge.SubpatternCode)
	}
	subpatternTools := map[string][]string{}
	toolSubpatterns := map[string][]string{}
	for _, edge := range prereqEdges {
		subpatternTools[edge.SubpatternCode] = append(subpatternTools[edge.SubpatternCode], edge.ToolCode)
		toolSubpatterns[edge.ToolCode] = append(toolSubpatterns[edge.ToolCode], edge.SubpatternCode)
	}

	resp := AtlasResponse{
		TaxonomyVersion: TaxonomyVersion,
		Tools:           []AtlasTool{},
		Families:        []AtlasFamily{},
		Subpatterns:     []AtlasSubpattern{},
		Company:         overlay,
	}

	for _, node := range nodes {
		switch node.Kind {
		case "tool":
			resp.Tools = append(resp.Tools, AtlasTool{
				Code:            node.Code,
				Name:            node.Name,
				Position:        int(node.Position),
				SubpatternCodes: orEmpty(toolSubpatterns[node.Code]),
			})
		case "family":
			resp.Families = append(resp.Families, AtlasFamily{
				Code:            node.Code,
				Name:            node.Name,
				Description:     node.Description,
				Position:        int(node.Position),
				SubpatternCodes: orEmpty(familySubpatterns[node.Code]),
			})
		case "subpattern":
			nodeStats := stats[node.Code]
			sub := AtlasSubpattern{
				Code:        node.Code,
				Name:        node.Name,
				Position:    int(node.Position),
				FamilyCodes: orEmpty(subpatternFamilies[node.Code]),
				ToolCodes:   orEmpty(subpatternTools[node.Code]),
				Stats:       nodeStats,
				Mastery:     computeMastery(nodeStats),
			}
			if rel, ok := relevanceByCode[node.Code]; ok {
				relCopy := rel
				sub.Relevance = &relCopy
			}
			resp.Subpatterns = append(resp.Subpatterns, sub)
		}
	}

	if overlay != nil {
		overlay.Coverage = computeCoverage(resp.Subpatterns)
		problems, err := r.q.ListCompanyRelevantProblems(ctx, db.ListCompanyRelevantProblemsParams{
			UserID:      userID,
			CompanyCode: companyCode,
		})
		if err != nil {
			return AtlasResponse{}, fmt.Errorf("atlas: list company relevant problems: %w", err)
		}
		overlay.RelevantProblems = make([]AtlasRelevantProblem, 0, len(problems))
		for _, row := range problems {
			overlay.RelevantProblems = append(overlay.RelevantProblems, AtlasRelevantProblem{
				PracticeProblem: PracticeProblem{
					ID:           row.ID,
					Title:        row.Title,
					URL:          row.Url,
					Difficulty:   row.Difficulty,
					Tier:         row.Tier,
					Status:       row.Status,
					NextReviewAt: timestamptzPtr(row.NextReviewAt),
				},
				SubpatternCode: row.SubpatternCode,
				SubpatternName: row.SubpatternName,
				EvidenceCount:  int(row.EvidenceCount),
				LastSeenAt:     dateString(row.LastSeenAt),
				SourceType:     row.SourceType,
			})
		}
	}

	return resp, nil
}

func computeCoverage(subpatterns []AtlasSubpattern) AtlasCoverage {
	coverage := AtlasCoverage{TopGaps: []AtlasGap{}}
	type gap struct {
		AtlasGap
		score int
	}
	gaps := []gap{}
	for _, sub := range subpatterns {
		if sub.Relevance == nil {
			continue
		}
		weight := relevanceWeight[sub.Relevance.Relevance]
		if weight == 0 {
			// insufficient_evidence / no_evidence: shown on the node, but not
			// counted as company-readiness signal.
			continue
		}
		coverage.RelevantSubpatterns++
		switch sub.Mastery.Status {
		case MasteryStrong, MasteryMastered:
			coverage.Strong++
		case MasteryUnstable:
			coverage.Unstable++
		case MasteryWeak, MasteryLearning:
			coverage.Weak++
		default:
			coverage.NotStarted++
		}
		if sub.Mastery.Percent < 70 {
			gaps = append(gaps, gap{
				AtlasGap: AtlasGap{
					Code:           sub.Code,
					Name:           sub.Name,
					Relevance:      sub.Relevance.Relevance,
					MasteryPercent: sub.Mastery.Percent,
				},
				score: weight * (100 - sub.Mastery.Percent),
			})
		}
	}
	sort.SliceStable(gaps, func(i, j int) bool { return gaps[i].score > gaps[j].score })
	for i, g := range gaps {
		if i >= topGapsLimit {
			break
		}
		coverage.TopGaps = append(coverage.TopGaps, g.AtlasGap)
	}
	return coverage
}

// userSubpatternStats merges the four per-user aggregate queries into one
// stats struct per subpattern code.
func (r *pgRepository) userSubpatternStats(ctx context.Context, userID int64) (map[string]SubpatternStats, error) {
	stats := map[string]SubpatternStats{}

	problemRows, err := r.q.ListUserSubpatternProblemStats(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("atlas: list problem stats: %w", err)
	}
	for _, row := range problemRows {
		s := stats[row.Code]
		s.ProblemCount = int(row.ProblemCount)
		s.SolvedCount = int(row.SolvedCount)
		s.InProgressCount = int(row.InProgressCount)
		s.DueCount += int(row.DueProblemCount)
		s.LastSolvedAt = timePtr(row.LastSolvedAt)
		stats[row.Code] = s
	}

	attemptRows, err := r.q.ListUserSubpatternAttemptStats(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("atlas: list attempt stats: %w", err)
	}
	for _, row := range attemptRows {
		s := stats[row.Code]
		s.AttemptCount = int(row.AttemptCount)
		s.HardCount = int(row.HardCount)
		stats[row.Code] = s
	}

	reviewRows, err := r.q.ListUserSubpatternReviewStats(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("atlas: list review stats: %w", err)
	}
	for _, row := range reviewRows {
		s := stats[row.Code]
		s.DueCount += int(row.DueCount)
		s.NextReviewAt = timePtr(row.NextReviewAt)
		stats[row.Code] = s
	}

	cardRows, err := r.q.ListSubpatternCardCounts(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("atlas: list card counts: %w", err)
	}
	for _, row := range cardRows {
		s := stats[row.Code]
		s.CardCount = int(row.CardCount)
		stats[row.Code] = s
	}

	return stats, nil
}

func (r *pgRepository) ListCompanies(ctx context.Context) ([]AtlasCompany, error) {
	rows, err := r.q.ListAtlasCompanies(ctx)
	if err != nil {
		return nil, fmt.Errorf("atlas: list companies: %w", err)
	}
	companies := make([]AtlasCompany, 0, len(rows))
	for _, row := range rows {
		companies = append(companies, AtlasCompany{
			Code:            row.Code,
			Name:            row.Name,
			SubpatternCount: int(row.SubpatternCount),
			DemoOnly:        row.DemoOnly,
			LastSeenAt:      dateString(row.LastSeenAt),
		})
	}
	return companies, nil
}

// GetAtlasNode returns the educational detail for any taxonomy node.
func (r *pgRepository) GetAtlasNode(ctx context.Context, userID int64, code string) (NodeDetail, error) {
	node, err := r.q.GetAtlasNodeByCode(ctx, code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return NodeDetail{}, ErrPatternNotFound
		}
		return NodeDetail{}, fmt.Errorf("atlas: get node: %w", err)
	}

	detail := NodeDetail{
		Code:                node.Code,
		Name:                node.Name,
		Kind:                node.Kind,
		Description:         node.Description,
		TaxonomyVersion:     node.TaxonomyVersion.String,
		Techniques:          orEmpty(node.Techniques),
		RecognitionSymptoms: orEmpty(node.RecognitionSymptoms),
		Checklist:           orEmpty(node.Checklist),
		ExampleProblems:     []ExampleProblem{},
		Cards:               []CardSummary{},
		Practice:            []PracticeProblem{},
		CompanyPractice:     []CompanyPracticeGroup{},
		RelevantCompanies:   []RelevantCompany{},
	}

	material, err := r.learningMaterial(ctx, node.ID)
	if err != nil {
		return NodeDetail{}, err
	}
	detail.Material = material

	switch node.Kind {
	case "subpattern":
		if err := r.fillSubpatternDetail(ctx, userID, node.ID, &detail); err != nil {
			return NodeDetail{}, err
		}
	case "family":
		if err := r.fillFamilyDetail(ctx, node.Code, &detail); err != nil {
			return NodeDetail{}, err
		}
		examples, err := r.q.ListPatternExampleProblems(ctx, db.ListPatternExampleProblemsParams{
			PatternID: node.ID,
			Limit:     defaultExampleProblemsLimit,
		})
		if err != nil {
			return NodeDetail{}, fmt.Errorf("atlas: list example problems: %w", err)
		}
		detail.ExampleProblems = exampleProblemsFromRows(examples)
	}

	return detail, nil
}

func (r *pgRepository) learningMaterial(ctx context.Context, patternID int64) (*LearningMaterial, error) {
	row, err := r.q.GetPatternLearningMaterial(ctx, patternID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("atlas: get learning material: %w", err)
	}
	pairs := []ContrastPair{}
	if len(row.DontConfuseWith) > 0 {
		if err := json.Unmarshal(row.DontConfuseWith, &pairs); err != nil {
			return nil, fmt.Errorf("atlas: decode dont_confuse_with: %w", err)
		}
	}
	return &LearningMaterial{
		WhatItIs:          row.WhatItIs,
		MentalModel:       row.MentalModel,
		RecognitionCues:   orEmpty(row.RecognitionCues),
		AntiCues:          orEmpty(row.AntiCues),
		CoreInvariant:     row.CoreInvariant,
		CanonicalSkeleton: row.CanonicalSkeleton,
		CommonMistakes:    orEmpty(row.CommonMistakes),
		DontConfuseWith:   pairs,
	}, nil
}

func (r *pgRepository) fillFamilyDetail(ctx context.Context, familyCode string, detail *NodeDetail) error {
	nodes, err := r.q.ListTaxonomyNodes(ctx, pgtype.Text{String: TaxonomyVersion, Valid: true})
	if err != nil {
		return fmt.Errorf("atlas: list nodes: %w", err)
	}
	names := make(map[string]string, len(nodes))
	for _, node := range nodes {
		names[node.Code] = node.Name
	}
	edges, err := r.q.ListFamilySubpatternEdges(ctx)
	if err != nil {
		return fmt.Errorf("atlas: list family edges: %w", err)
	}
	detail.Subpatterns = []NodeRef{}
	for _, edge := range edges {
		if edge.FamilyCode != familyCode {
			continue
		}
		detail.Subpatterns = append(detail.Subpatterns, NodeRef{
			Code: edge.SubpatternCode,
			Name: names[edge.SubpatternCode],
		})
	}
	return nil
}

func (r *pgRepository) fillSubpatternDetail(ctx context.Context, userID, nodeID int64, detail *NodeDetail) error {
	families, err := r.q.ListSubpatternFamilies(ctx, nodeID)
	if err != nil {
		return fmt.Errorf("atlas: list subpattern families: %w", err)
	}
	detail.Families = []NodeRef{}
	for _, row := range families {
		detail.Families = append(detail.Families, NodeRef{Code: row.Code, Name: row.Name})
	}

	tools, err := r.q.ListSubpatternTools(ctx, nodeID)
	if err != nil {
		return fmt.Errorf("atlas: list subpattern tools: %w", err)
	}
	detail.Tools = []NodeRef{}
	for _, row := range tools {
		detail.Tools = append(detail.Tools, NodeRef{Code: row.Code, Name: row.Name})
	}

	stats, err := r.userSubpatternStats(ctx, userID)
	if err != nil {
		return err
	}
	nodeStats := stats[detail.Code]
	mastery := computeMastery(nodeStats)
	detail.Stats = &nodeStats
	detail.Mastery = &mastery

	cards, err := r.q.ListPatternCardSummaries(ctx, db.ListPatternCardSummariesParams{
		UserID:    userID,
		PatternID: nodeID,
	})
	if err != nil {
		return fmt.Errorf("atlas: list card summaries: %w", err)
	}
	for _, row := range cards {
		detail.Cards = append(detail.Cards, CardSummary{
			ID:           row.ID,
			Type:         row.Type,
			Question:     row.Question,
			NextReviewAt: timestamptzPtr(row.NextReviewAt),
			LastRating:   row.LastRating.String,
		})
	}

	practice, err := r.q.ListSubpatternPracticeProblems(ctx, db.ListSubpatternPracticeProblemsParams{
		UserID:       userID,
		SubpatternID: nodeID,
	})
	if err != nil {
		return fmt.Errorf("atlas: list practice problems: %w", err)
	}
	for _, row := range practice {
		detail.Practice = append(detail.Practice, PracticeProblem{
			ID:           row.ID,
			Title:        row.Title,
			URL:          row.Url,
			Difficulty:   row.Difficulty,
			Tier:         row.Tier,
			Status:       row.Status,
			Rating:       row.Rating.String,
			SolvedAt:     timestamptzPtr(row.SolvedAt),
			NextReviewAt: timestamptzPtr(row.NextReviewAt),
		})
	}

	companyProblems, err := r.q.ListSubpatternCompanyProblems(ctx, db.ListSubpatternCompanyProblemsParams{
		UserID:       userID,
		SubpatternID: nodeID,
	})
	if err != nil {
		return fmt.Errorf("atlas: list company problems: %w", err)
	}
	groupIndex := map[string]int{}
	for _, row := range companyProblems {
		idx, ok := groupIndex[row.CompanyCode]
		if !ok {
			idx = len(detail.CompanyPractice)
			groupIndex[row.CompanyCode] = idx
			detail.CompanyPractice = append(detail.CompanyPractice, CompanyPracticeGroup{
				Company:  NodeRef{Code: row.CompanyCode, Name: row.CompanyName},
				Problems: []CompanyPracticeProblem{},
			})
		}
		detail.CompanyPractice[idx].Problems = append(detail.CompanyPractice[idx].Problems, CompanyPracticeProblem{
			PracticeProblem: PracticeProblem{
				ID:           row.ID,
				Title:        row.Title,
				URL:          row.Url,
				Difficulty:   row.Difficulty,
				Status:       row.Status,
				NextReviewAt: timestamptzPtr(row.NextReviewAt),
			},
			EvidenceCount: int(row.EvidenceCount),
			LastSeenAt:    dateString(row.LastSeenAt),
			SourceType:    row.SourceType,
		})
	}

	relevant, err := r.q.ListSubpatternRelevantCompanies(ctx, nodeID)
	if err != nil {
		return fmt.Errorf("atlas: list relevant companies: %w", err)
	}
	for _, row := range relevant {
		detail.RelevantCompanies = append(detail.RelevantCompanies, RelevantCompany{
			Code: row.Code,
			Name: row.Name,
			CompanyRelevance: CompanyRelevance{
				Relevance:     row.Relevance,
				Confidence:    row.Confidence,
				EvidenceCount: int(row.EvidenceCount),
				LastSeenAt:    dateString(row.LastSeenAt),
				SourceType:    row.SourceType,
			},
		})
	}

	return nil
}

func orEmpty(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func timePtr(value pgtype.Timestamptz) *time.Time {
	return timestamptzPtr(value)
}

func timestamptzPtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	t := value.Time
	return &t
}

func dateString(value pgtype.Date) string {
	if !value.Valid {
		return ""
	}
	return value.Time.Format("2006-01-02")
}
