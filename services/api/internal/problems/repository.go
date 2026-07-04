package problems

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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

func (r *pgRepository) GetByID(ctx context.Context, userID, problemID int64) (ProblemDetail, error) {
	row, err := r.q.GetUserProblem(ctx, db.GetUserProblemParams{UserID: userID, ProblemID: problemID})
	if errors.Is(err, pgx.ErrNoRows) {
		return ProblemDetail{}, errNotFound
	}
	if err != nil {
		return ProblemDetail{}, fmt.Errorf("problems: get by id: %w", err)
	}

	d := ProblemDetail{
		ID:         row.ID,
		ExternalID: row.ExternalID,
		Title:      row.Title,
		URL:        row.Url,
		Platform:   row.Platform,
		Difficulty: row.Difficulty,
		Status:     row.Status,
		CreatedAt:  timeFromPg(row.CreatedAt),
	}
	if row.PatternID.Valid && row.PatternName.Valid {
		d.Pattern = &ProblemPattern{ID: row.PatternID.String, Name: row.PatternName.String}
	}
	if row.NextReviewAt.Valid {
		t := row.NextReviewAt.Time.UTC()
		d.NextReviewAt = &t
	}
	if row.LastRating.Valid {
		d.LastRating = &row.LastRating.String
	}
	if row.SolvedAt.Valid {
		t := row.SolvedAt.Time.UTC()
		d.SolvedAt = &t
	}
	if row.Note.Valid {
		d.Note = &row.Note.String
	}
	return d, nil
}

func (r *pgRepository) Save(ctx context.Context, userID, problemID int64) (string, error) {
	row, err := r.q.UpsertProblemProgress(ctx, db.UpsertProblemProgressParams{UserID: userID, ProblemID: problemID})
	if err != nil {
		var pgErr *pgconn.PgError
		// 23503 = foreign_key_violation: problem does not exist.
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return "", errNotFound
		}
		return "", fmt.Errorf("problems: save: %w", err)
	}
	if err := r.q.CreateProblemScheduleIfAbsent(ctx, db.CreateProblemScheduleIfAbsentParams{UserID: userID, ProblemID: problemID}); err != nil {
		return "", fmt.Errorf("problems: create schedule: %w", err)
	}
	status := "not_started"
	if row.Status.Valid {
		status = row.Status.String
	}
	return status, nil
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
