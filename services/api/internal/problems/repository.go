package problems

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

type pgRepository struct {
	q *db.Queries
}

func NewRepository(pool *pgxpool.Pool) *pgRepository {
	return &pgRepository{q: db.New(pool)}
}

func (r *pgRepository) List(ctx context.Context, userID int64, params ListParams) ([]Problem, error) {
	rows, err := r.q.ListUserProblems(ctx, db.ListUserProblemsParams{
		Status:          params.Status,
		Platform:        params.Platform,
		CursorCreatedAt: toPgTimestamptz(params.Cursor.CreatedAt),
		CursorID:        params.Cursor.ID,
		LimitRows:       params.Limit,
		UserID:          userID,
	})
	if err != nil {
		return nil, fmt.Errorf("problems: list user problems: %w", err)
	}

	items := make([]Problem, 0, len(rows))
	for _, row := range rows {
		items = append(items, problemFromRow(row))
	}
	return items, nil
}

func problemFromRow(row db.ListUserProblemsRow) Problem {
	return Problem{
		ID:           row.ID,
		ExternalID:   row.ExternalID,
		Title:        row.Title,
		URL:          row.Url,
		Platform:     row.Platform,
		Difficulty:   row.Difficulty,
		Pattern:      patternFromRow(row.PatternID, row.PatternName),
		Status:       row.Status,
		NextReviewAt: timePtrFromPg(row.NextReviewAt),
		LastRating:   stringPtrFromPg(row.LastRating),
		SolvedAt:     timePtrFromPg(row.SolvedAt),
		CreatedAt:    timeFromPg(row.CreatedAt),
		UpdatedAt:    timeFromPg(row.UpdatedAt),
	}
}

func patternFromRow(id pgtype.Text, name pgtype.Text) *ProblemPattern {
	if !id.Valid || !name.Valid {
		return nil
	}
	return &ProblemPattern{ID: id.String, Name: name.String}
}

func stringPtrFromPg(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func timePtrFromPg(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	v := value.Time.UTC()
	return &v
}

func timeFromPg(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Unix(0, 0).UTC()
	}
	return value.Time.UTC()
}

func toPgTimestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}
