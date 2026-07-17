package quiz

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

var errNotFound = errors.New("question not found")

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
		return nil, fmt.Errorf("quiz: list session: %w", err)
	}

	items := make([]sessionQuestion, 0, len(rows))
	for _, row := range rows {
		var opts []string
		if err := json.Unmarshal(row.Options, &opts); err != nil {
			return nil, fmt.Errorf("quiz: decode options: %w", err)
		}
		if opts == nil {
			opts = []string{}
		}
		q := sessionQuestion{
			ID:          row.ID,
			Question:    row.Question,
			Options:     opts,
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
		return questionDetail{}, fmt.Errorf("quiz: get question: %w", err)
	}

	var options []string
	if err := json.Unmarshal(row.Options, &options); err != nil {
		return questionDetail{}, fmt.Errorf("quiz: decode question options: %w", err)
	}
	d := questionDetail{CorrectOption: int(row.CorrectOption), OptionCount: len(options)}
	if row.Explanation.Valid {
		d.Explanation = &row.Explanation.String
	}
	if row.ProblemID.Valid {
		v := row.ProblemID.Int64
		d.ProblemID = &v
	}
	return d, nil
}

// RecordAnswer фиксирует ответ пользователя и возвращает количество затронутых
// строк: 1 — ответ записан, 0 — пара (user_id, question_id) уже существует
// (сработал анти-чит, см. UNIQUE-ограничение в миграции 000011).
func (r *pgRepository) RecordAnswer(ctx context.Context, p recordAnswerParams) (int64, error) {
	rows, err := r.q.RecordQuizAnswer(ctx, db.RecordQuizAnswerParams{
		UserID:         p.UserID,
		QuestionID:     p.QuestionID,
		SelectedOption: p.SelectedOption,
		WasCorrect:     p.WasCorrect,
	})
	if err != nil {
		return 0, fmt.Errorf("quiz: record answer: %w", err)
	}
	return rows, nil
}
