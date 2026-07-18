package roadmap

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/companies"
	"github.com/mxdtrip/freeburger/services/api/internal/patterns"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

var ErrUserNotFound = errors.New("roadmap: user not found")

// atlasSource is the subset of the patterns package's repository roadmap
// depends on. Reusing it means roadmap weeks are built from the same live
// mastery data (user_problem_progress, review_attempts, ...) Pattern Atlas
// already computes, instead of the old static neetcode_150 seed that never
// reflected what a user actually solved.
type atlasSource interface {
	GetAtlas(ctx context.Context, userID int64, companyCode string) (patterns.AtlasResponse, error)
}

type pgRepository struct {
	q     *db.Queries
	atlas atlasSource
}

func NewRepository(pool *pgxpool.Pool) *pgRepository {
	return &pgRepository{q: db.New(pool), atlas: patterns.NewRepository(pool)}
}

func (r *pgRepository) Get(ctx context.Context, userID int64) (Response, error) {
	target, err := r.target(ctx, userID)
	if err != nil {
		return Response{}, err
	}

	atlas, err := r.atlas.GetAtlas(ctx, userID, "")
	if err != nil {
		return Response{}, fmt.Errorf("roadmap: get atlas: %w", err)
	}

	return buildResponse(target, atlas), nil
}

func (r *pgRepository) target(ctx context.Context, userID int64) (Target, error) {
	row, err := r.q.GetRoadmapUserTarget(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Target{}, ErrUserNotFound
		}
		return Target{}, fmt.Errorf("roadmap: get user target: %w", err)
	}
	return targetFromRow(row), nil
}

func targetFromRow(row db.GetRoadmapUserTargetRow) Target {
	var company *Company
	if name := textPtr(row.TargetCompany); name != nil {
		company = buildCompany(*name)
	}
	topics := row.TargetTopics
	if topics == nil {
		topics = []string{}
	}
	return Target{
		Company:       company,
		InterviewDate: datePtr(row.InterviewDate),
		Topics:        topics,
	}
}

// buildCompany enriches a free-text target company with a catalog code when
// the name matches the autocomplete catalog; otherwise it returns the name
// as-is with a null code.
func buildCompany(name string) *Company {
	if found, ok := companies.Lookup(name); ok {
		code := found.ID
		return &Company{Code: &code, Name: found.Name}
	}
	return &Company{Code: nil, Name: name}
}

// buildResponse turns one atlas snapshot into a roadmap: one week per
// pattern family, in taxonomy position order, with progress rolled up from
// the family's subpatterns' real solve stats. A week's practice CTA points
// at that family's weakest subpattern — the one most worth training next.
func buildResponse(target Target, atlas patterns.AtlasResponse) Response {
	subpatternByCode := make(map[string]patterns.AtlasSubpattern, len(atlas.Subpatterns))
	for _, sub := range atlas.Subpatterns {
		subpatternByCode[sub.Code] = sub
	}

	families := append([]patterns.AtlasFamily(nil), atlas.Families...)
	sort.SliceStable(families, func(i, j int) bool { return families[i].Position < families[j].Position })

	weeks := make([]Week, 0, len(families))
	totalProblems, totalSolved := 0, 0

	for i, family := range families {
		familyTotal, familySolved := 0, 0
		weakestCode := ""
		weakestPercent := 101
		for _, code := range family.SubpatternCodes {
			sub, ok := subpatternByCode[code]
			if !ok {
				continue
			}
			familyTotal += sub.Stats.ProblemCount
			familySolved += sub.Stats.SolvedCount
			if weakestCode == "" || sub.Mastery.Percent < weakestPercent {
				weakestCode = sub.Code
				weakestPercent = sub.Mastery.Percent
			}
		}

		progress := percent(familySolved, familyTotal)
		totalProblems += familyTotal
		totalSolved += familySolved

		topics := []string{}
		if weakestCode != "" {
			topics = []string{weakestCode}
		}

		weeks = append(weeks, Week{
			ID:       fmt.Sprintf("week_%02d", i+1),
			Label:    fmt.Sprintf("week %02d", i+1),
			Title:    family.Name,
			Progress: progress,
			Focus:    family.Description,
			Status:   roadmapStatus(progress),
			Topics:   topics,
		})
	}

	return Response{
		OverallProgress: percent(totalSolved, totalProblems),
		Target:          target,
		Weeks:           weeks,
	}
}

func roadmapStatus(progress int) string {
	switch {
	case progress >= 100:
		return "done"
	case progress > 0:
		return "active"
	default:
		return "todo"
	}
}

func percent(done, total int) int {
	if total <= 0 || done <= 0 {
		return 0
	}
	return int(float64(done)/float64(total)*100 + 0.5)
}

func textPtr(value pgtype.Text) *string {
	if !value.Valid || value.String == "" {
		return nil
	}
	text := value.String
	return &text
}

func datePtr(value pgtype.Timestamptz) *string {
	if !value.Valid {
		return nil
	}
	date := value.Time.UTC().Format(time.DateOnly)
	return &date
}
