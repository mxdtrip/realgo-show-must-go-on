package quiz

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

var errNotFound = errors.New("question not found")

type repository interface {
	ListQuizSession(ctx context.Context, userID int64, limit int32) ([]sessionQuestion, error)
	GetQuizQuestion(ctx context.Context, questionID, userID int64) (questionDetail, error)
}

type pgRepository struct{ q *db.Queries }

func NewRepository(pool *pgxpool.Pool) *pgRepository {
	return &pgRepository{q: db.New(pool)}
}

func (r *pgRepository) ListQuizSession(ctx context.Context, userID int64, limit int32) ([]sessionQuestion, error) {
	rows, err := r.q.ListQuizSession(ctx, db.ListQuizSessionParams{
		UserID:       userID,
		SessionLimit: limit,
	})
	if err != nil {
		return nil, err
	}

	items := make([]sessionQuestion, 0, len(rows))
	for _, row := range rows {
		q := sessionQuestion{
			ID:          row.ID,
			Question:    row.Question,
			Options:     row.Options,
			CreatedByAI: row.CreatedByAi.Bool,
		}
		if row.CreatedAt.Valid {
			t := row.CreatedAt.Time.UTC()
			q.CreatedAt = &t
		}
		if row.Difficulty.Valid {
			q.Difficulty = &row.Difficulty.String
		}
		if row.ProblemID.Valid {
			v := row.ProblemID.Int64
			q.ProblemID = &v
		}
		if row.ProblemTitle.Valid {
			q.ProblemTitle = &row.ProblemTitle.String
		}
		if row.PatternID.Valid {
			v := row.PatternID.Int64
			q.PatternID = &v
		}
		if row.PatternName.Valid {
			q.PatternName = &row.PatternName.String
		}
		items = append(items, q)
	}
	return items, nil
}

func (r *pgRepository) GetQuizQuestion(ctx context.Context, questionID, userID int64) (questionDetail, error) {
	row, err := r.q.GetQuizQuestion(ctx, db.GetQuizQuestionParams{
		QuestionID: questionID,
		UserID:     userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return questionDetail{}, errNotFound
	}
	if err != nil {
		return questionDetail{}, err
	}

	d := questionDetail{CorrectOption: int(row.CorrectOption)}
	if row.Explanation.Valid {
		d.Explanation = &row.Explanation.String
	}
	return d, nil
}
