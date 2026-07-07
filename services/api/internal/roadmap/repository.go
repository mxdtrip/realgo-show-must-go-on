package roadmap

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

var ErrUserNotFound = errors.New("roadmap: user not found")

type pgRepository struct {
	q *db.Queries
}

type roadmapItem struct {
	Position    int
	PatternCode string
	PatternName string
	ProblemID   int64
	ExternalID  *string
	Slug        string
	Title       string
	URL         string
	Difficulty  string
	Status      string
	Rating      *string
	Confidence  *int32
}

func NewRepository(pool *pgxpool.Pool) *pgRepository {
	return &pgRepository{q: db.New(pool)}
}

func (r *pgRepository) Get(ctx context.Context, userID int64) (Response, error) {
	target, err := r.target(ctx, userID)
	if err != nil {
		return Response{}, err
	}

	rows, err := r.q.ListUserRoadmapItems(ctx, db.ListUserRoadmapItemsParams{
		RoadmapCode: neetcode150Code,
		UserID:      userID,
	})
	if err != nil {
		return Response{}, fmt.Errorf("roadmap: list items: %w", err)
	}

	items := make([]roadmapItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, roadmapItem{
			Position:    int(row.Position),
			PatternCode: row.PatternCode,
			PatternName: row.PatternName,
			ProblemID:   row.ProblemID,
			ExternalID:  textPtr(row.ExternalID),
			Slug:        row.ExternalSlug,
			Title:       row.Title,
			URL:         row.Url,
			Difficulty:  textOr(row.Difficulty, "unknown"),
			Status:      statusOrDefault(row.Status),
			Rating:      textPtr(row.Rating),
			Confidence:  int32Ptr(row.Confidence),
		})
	}

	return buildResponse(target, items), nil
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
	return Target{
		Company:       textPtr(row.TargetCompany),
		InterviewDate: datePtr(row.InterviewDate),
	}
}

func buildResponse(target Target, items []roadmapItem) Response {
	patterns := make([]Pattern, 0)
	patternByCode := make(map[string]int)

	totalProblems := 0
	totalSolved := 0

	for _, item := range items {
		status := statusOrDefault(item.Status)
		index, ok := patternByCode[item.PatternCode]
		if !ok {
			patterns = append(patterns, Pattern{
				ID:       "pat_" + item.PatternCode,
				Code:     item.PatternCode,
				Name:     item.PatternName,
				Problems: []Problem{},
			})
			index = len(patterns) - 1
			patternByCode[item.PatternCode] = index
		}

		problem := Problem{
			ID:         item.ProblemID,
			ExternalID: item.ExternalID,
			Slug:       item.Slug,
			Title:      item.Title,
			URL:        item.URL,
			Difficulty: item.Difficulty,
			Status:     status,
			Rating:     item.Rating,
			Confidence: item.Confidence,
			Position:   item.Position,
		}

		pattern := &patterns[index]
		pattern.Problems = append(pattern.Problems, problem)
		pattern.TotalProblems++
		totalProblems++

		if solvedStatus(status) {
			pattern.SolvedProblems++
			totalSolved++
		}
		if inProgressStatus(status) {
			pattern.InProgressProblems++
		}
	}

	weeks := make([]Week, 0, len(patterns))
	for i := range patterns {
		patterns[i].Progress = percent(patterns[i].SolvedProblems, patterns[i].TotalProblems)
		weeks = append(weeks, Week{
			ID:       fmt.Sprintf("week_%02d", i+1),
			Label:    fmt.Sprintf("week %02d", i+1),
			Title:    patterns[i].Name,
			Progress: patterns[i].Progress,
			Focus:    "solve pattern problems and reviews",
			Status:   roadmapStatus(patterns[i].Progress),
			Topics:   []string{patterns[i].Code},
		})
	}

	return Response{
		OverallProgress: percent(totalSolved, totalProblems),
		Target:          target,
		Weeks:           weeks,
		Patterns:        patterns,
	}
}

func solvedStatus(status string) bool {
	return status == "solved" || status == "reviewing"
}

func inProgressStatus(status string) bool {
	return status == "in_progress"
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

func statusOrDefault(status string) string {
	if status == "" {
		return "not_started"
	}
	return status
}

func textOr(value pgtype.Text, fallback string) string {
	if !value.Valid || value.String == "" {
		return fallback
	}
	return value.String
}

func textPtr(value pgtype.Text) *string {
	if !value.Valid || value.String == "" {
		return nil
	}
	text := value.String
	return &text
}

func int32Ptr(value pgtype.Int4) *int32 {
	if !value.Valid {
		return nil
	}
	return &value.Int32
}

func datePtr(value pgtype.Timestamptz) *string {
	if !value.Valid {
		return nil
	}
	date := value.Time.UTC().Format(time.DateOnly)
	return &date
}
