package quiz

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"
)

var (
	// ErrQuestionNotFound — вопроса нет или он не принадлежит пользователю.
	ErrQuestionNotFound = errors.New("quiz: question not found")
	// ErrAlreadyAnswered — пользователь уже отвечал на этот вопрос (анти-чит).
	ErrAlreadyAnswered = errors.New("quiz: question already answered")
	// ErrInvalidOption — индекс ответа находится вне массива options.
	ErrInvalidOption = errors.New("quiz: option is out of range")
)

// repository — consumer-side интерфейс сервиса: только те операции с данными,
// что нужны бизнес-логике викторины.
type repository interface {
	ListQuizSession(ctx context.Context, userID int64, limit int32) ([]sessionQuestion, error)
	GetQuizQuestion(ctx context.Context, questionID, userID int64) (questionDetail, error)
	// RecordAnswer возвращает количество затронутых строк (0 = повторный ответ).
	RecordAnswer(ctx context.Context, p recordAnswerParams) (int64, error)
}

// ProblemRater оценивает задачу в FSRS по problem_id. Удовлетворяется
// структурно service.ReviewService (метод RateByProblemID): FSRS-движок,
// сохранение расписания и обновление confidence инкапсулированы в review,
// поэтому викторина не дублирует ни того, ни другого (и не делает двойной
// confidence-delta — см. RateReview, который сам зовёт UpdateProgressConfidence).
type ProblemRater interface {
	RateByProblemID(ctx context.Context, userID, problemID int64, rating string, reviewedAt time.Time) error
}

type recordAnswerParams struct {
	UserID         int64
	QuestionID     int64
	SelectedOption int32
	WasCorrect     bool
}

// Service — бизнес-логика викторины.
type Service struct {
	repo  repository
	rater ProblemRater
}

func NewService(repo repository, rater ProblemRater) *Service {
	return &Service{repo: repo, rater: rater}
}

// ListSession отдаёт вопросы сессии (делегирует репозиторию).
func (s *Service) ListSession(ctx context.Context, userID int64, limit int32) ([]sessionQuestion, error) {
	items, err := s.repo.ListQuizSession(ctx, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("quiz: list session: %w", err)
	}
	return items, nil
}

// RecordAnswer проверяет корректность ответа, фиксирует его (анти-чит), затем
// засчитывает ответ в spaced-repetition: задача оценивается в FSRS через
// review-сервис. Верный ответ → "normal" (fsrs.Good), неверный → "hard".
func (s *Service) RecordAnswer(ctx context.Context, userID, questionID int64, option int) (answerResult, error) {
	q, err := s.repo.GetQuizQuestion(ctx, questionID, userID)
	if errors.Is(err, errNotFound) {
		return answerResult{}, ErrQuestionNotFound
	}
	if err != nil {
		return answerResult{}, fmt.Errorf("quiz: get question: %w", err)
	}
	if option < 0 || option >= q.OptionCount {
		return answerResult{}, ErrInvalidOption
	}

	correct := option == q.CorrectOption

	// Анти-чит: rows==0 означает, что (user_id, question_id) уже существует.
	rows, err := s.repo.RecordAnswer(ctx, recordAnswerParams{
		UserID:         userID,
		QuestionID:     questionID,
		SelectedOption: int32(option),
		WasCorrect:     correct,
	})
	if err != nil {
		return answerResult{}, fmt.Errorf("quiz: record answer: %w", err)
	}
	if rows == 0 {
		return answerResult{}, ErrAlreadyAnswered
	}

	// Засчитываем ответ в FSRS только для вопросов, привязанных к problem.
	// Non-fatal: неудача review-рейтинга не должна обнулять зафиксированный
	// ответ (по образцу ReviewService.RateReview, где confidence-обновление
	// после SaveReview тоже non-fatal). Confidence обновляется внутри RateReview,
	// поэтому отдельного вызова здесь нет — иначе delta применилась бы дважды.
	if q.ProblemID != nil {
		rating := "hard"
		if correct {
			rating = "normal" // fsrs.Good
		}
		if err := s.rater.RateByProblemID(ctx, userID, *q.ProblemID, rating, time.Now().UTC()); err != nil {
			slog.Warn("quiz: FSRS rate failed (non-fatal)",
				slog.Int64("user_id", userID),
				slog.Int64("problem_id", *q.ProblemID),
				slog.String("rating", rating),
				slog.Any("err", err),
			)
		}
	}

	return answerResult{
		Correct:       correct,
		CorrectOption: q.CorrectOption,
		Explanation:   q.Explanation,
	}, nil
}
