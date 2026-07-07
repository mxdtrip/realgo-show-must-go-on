package quiz

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
)

var (
	// ErrQuestionNotFound — вопроса нет или он не принадлежит пользователю.
	ErrQuestionNotFound = errors.New("quiz: question not found")
	// ErrAlreadyAnswered — пользователь уже отвечал на этот вопрос (анти-чит).
	ErrAlreadyAnswered = errors.New("quiz: question already answered")
)

// repository — consumer-side интерфейс сервиса: только те операции с данными,
// что нужны бизнес-логике викторины.
type repository interface {
	ListQuizSession(ctx context.Context, userID int64, limit int32) ([]sessionQuestion, error)
	GetQuizQuestion(ctx context.Context, questionID, userID int64) (questionDetail, error)
	// RecordAnswer возвращает количество затронутых строк (0 = повторный ответ).
	RecordAnswer(ctx context.Context, p recordAnswerParams) (int64, error)
}

// ConfidenceUpdater обновляет user_problem_progress.confidence по рейтингу.
// Удовлетворяется структурно repo.ReviewRepository (метод UpdateProgressConfidence),
// поэтому формулы confidence (LEAST/GREATEST/COALESCE NULL→50) и маппинг
// rating→delta не дублируются внутри викторины.
type ConfidenceUpdater interface {
	UpdateProgressConfidence(ctx context.Context, userID, problemID int64, rating string) error
}

type recordAnswerParams struct {
	UserID         int64
	QuestionID     int64
	SelectedOption int32
	WasCorrect     bool
}

// Service — бизнес-логика викторины.
type Service struct {
	repo       repository
	confidence ConfidenceUpdater
}

func NewService(repo repository, confidence ConfidenceUpdater) *Service {
	return &Service{repo: repo, confidence: confidence}
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
// обновляет confidence задачи. FSRS-планирование по problem_id пока отсутствует
// (см. TODO «Этап 4»).
func (s *Service) RecordAnswer(ctx context.Context, userID, questionID int64, option int) (answerResult, error) {
	q, err := s.repo.GetQuizQuestion(ctx, questionID, userID)
	if errors.Is(err, errNotFound) {
		return answerResult{}, ErrQuestionNotFound
	}
	if err != nil {
		return answerResult{}, fmt.Errorf("quiz: get question: %w", err)
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

	// Confidence обновляем только для вопросов, привязанных к problem. Не атомарно
	// с insert'ом ответа — сознательно, по образцу ReviewService.RateReview, где
	// confidence-обновление после транзакционного SaveReview тоже non-fatal.
	if q.ProblemID != nil {
		// normal→0 (не двигает confidence), поэтому используем easy/hard.
		rating := "hard"
		if correct {
			rating = "easy"
		}
		if err := s.confidence.UpdateProgressConfidence(ctx, userID, *q.ProblemID, rating); err != nil {
			slog.Warn("quiz: confidence update failed (non-fatal)",
				slog.Int64("user_id", userID),
				slog.Int64("problem_id", *q.ProblemID),
				slog.Any("err", err),
			)
		}
	}

	// TODO(Этап 4): заменить заглушку на FSRS-планирование по problem_id
	//   (RateByProblemID: найти/создать review_schedule → FSRS). Сейчас
	//   намеренно отсутствует — инициализация FSRS по рейтингу не реализована.

	return answerResult{
		Correct:       correct,
		CorrectOption: q.CorrectOption,
		Explanation:   q.Explanation,
	}, nil
}
