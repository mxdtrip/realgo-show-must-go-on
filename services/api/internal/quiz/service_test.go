package quiz

import (
	"context"
	"errors"
	"testing"
	"time"
)

// Эти тесты — белым ящиком (package quiz), чтобы фейки могли реализовать
// непубличные consumer-side интерфейсы Service (repository, ProblemRater)
// и работать с непубличными типами (questionDetail, recordAnswerParams).

// --- fakes ---

type fakeRepo struct {
	// question, которое вернёт GetQuizQuestion.
	question questionDetail
	// err из GetQuizQuestion (например errNotFound).
	getErr error
	// строк, возвращаемых RecordAnswer (0 = повторный ответ / анти-чит).
	rows int64
	// err из RecordAnswer.
	recordErr error

	// записанные параметры последнего RecordAnswer.
	lastRecord  recordAnswerParams
	recordCalls int
}

func (f *fakeRepo) ListQuizSession(_ context.Context, _ int64, _ int32) ([]sessionQuestion, error) {
	return nil, nil
}

func (f *fakeRepo) GetQuizQuestion(_ context.Context, _, _ int64) (questionDetail, error) {
	return f.question, f.getErr
}

func (f *fakeRepo) RecordAnswer(_ context.Context, p recordAnswerParams) (int64, error) {
	f.lastRecord = p
	f.recordCalls++
	return f.rows, f.recordErr
}

type fakeRater struct {
	calls []fakeRaterCall
	err   error
}

type fakeRaterCall struct {
	UserID    int64
	ProblemID int64
	Rating    string
}

func (f *fakeRater) RateByProblemID(_ context.Context, userID, problemID int64, rating string, _ time.Time) error {
	f.calls = append(f.calls, fakeRaterCall{UserID: userID, ProblemID: problemID, Rating: rating})
	return f.err
}

func int64Ptr(v int64) *int64 { return &v }

func quizQuestion(correctOption int, problemID *int64) questionDetail {
	return questionDetail{CorrectOption: correctOption, OptionCount: 4, ProblemID: problemID}
}

// --- tests ---

// 1. ProblemID задан, верный ответ → Correct=true, FSRS-рейтинг "normal" (fsrs.Good).
func TestRecordAnswer_CorrectAnswer_RatesNormal(t *testing.T) {
	repo := &fakeRepo{
		question: quizQuestion(1, int64Ptr(42)),
		rows:     1,
	}
	rater := &fakeRater{}
	svc := NewService(repo, rater)

	res, err := svc.RecordAnswer(context.Background(), 7, 100, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Correct {
		t.Fatal("expected Correct=true")
	}
	if res.CorrectOption != 1 {
		t.Fatalf("expected CorrectOption=1, got %d", res.CorrectOption)
	}
	if len(rater.calls) != 1 {
		t.Fatalf("expected 1 rater call, got %d", len(rater.calls))
	}
	if rater.calls[0].Rating != "normal" {
		t.Fatalf("expected rating normal (fsrs.Good), got %q", rater.calls[0].Rating)
	}
	if rater.calls[0].ProblemID != 42 || rater.calls[0].UserID != 7 {
		t.Fatalf("unexpected rater call: %+v", rater.calls[0])
	}
	if repo.lastRecord.WasCorrect != true {
		t.Fatal("expected answer recorded as correct")
	}
}

// 2. ProblemID задан, неверный ответ → Correct=false, FSRS-рейтинг "hard".
func TestRecordAnswer_IncorrectAnswer_RatesHard(t *testing.T) {
	repo := &fakeRepo{
		question: quizQuestion(1, int64Ptr(42)),
		rows:     1,
	}
	rater := &fakeRater{}
	svc := NewService(repo, rater)

	res, err := svc.RecordAnswer(context.Background(), 7, 100, 0) // option 0 ≠ correct 1
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Correct {
		t.Fatal("expected Correct=false")
	}
	if len(rater.calls) != 1 || rater.calls[0].Rating != "hard" {
		t.Fatalf("expected 1 hard rater call, got %+v", rater.calls)
	}
	if repo.lastRecord.WasCorrect != false {
		t.Fatal("expected answer recorded as incorrect")
	}
}

// 3. ProblemID=nil (вопрос по pattern) → FSRS не вызывается.
func TestRecordAnswer_PatternOnly_SkipsRating(t *testing.T) {
	repo := &fakeRepo{
		question: quizQuestion(1, nil), // pattern-only
		rows:     1,
	}
	rater := &fakeRater{}
	svc := NewService(repo, rater)

	if _, err := svc.RecordAnswer(context.Background(), 7, 100, 1); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rater.calls) != 0 {
		t.Fatalf("expected no rater calls for pattern-only question, got %d", len(rater.calls))
	}
}

// 4. Вопрос не найден → ErrQuestionNotFound; ответ и FSRS не вызываются.
func TestRecordAnswer_QuestionNotFound(t *testing.T) {
	repo := &fakeRepo{
		getErr: errNotFound,
		rows:   1,
	}
	rater := &fakeRater{}
	svc := NewService(repo, rater)

	_, err := svc.RecordAnswer(context.Background(), 7, 100, 1)
	if !errors.Is(err, ErrQuestionNotFound) {
		t.Fatalf("expected ErrQuestionNotFound, got %v", err)
	}
	if repo.recordCalls != 0 {
		t.Fatalf("expected RecordAnswer not called, got %d calls", repo.recordCalls)
	}
	if len(rater.calls) != 0 {
		t.Fatalf("expected no rater calls, got %d", len(rater.calls))
	}
}

// 5. Повторный ответ (rows=0) → ErrAlreadyAnswered; FSRS не вызывается.
func TestRecordAnswer_AlreadyAnswered(t *testing.T) {
	repo := &fakeRepo{
		question: quizQuestion(1, int64Ptr(42)),
		rows:     0, // анти-чит: пара уже существует
	}
	rater := &fakeRater{}
	svc := NewService(repo, rater)

	_, err := svc.RecordAnswer(context.Background(), 7, 100, 1)
	if !errors.Is(err, ErrAlreadyAnswered) {
		t.Fatalf("expected ErrAlreadyAnswered, got %v", err)
	}
	if len(rater.calls) != 0 {
		t.Fatalf("expected no rater calls on replay, got %d", len(rater.calls))
	}
}

func TestRecordAnswer_RejectsOptionOutsideQuestionRange(t *testing.T) {
	for _, option := range []int{-1, 4} {
		repo := &fakeRepo{question: quizQuestion(1, int64Ptr(42)), rows: 1}
		rater := &fakeRater{}
		svc := NewService(repo, rater)

		_, err := svc.RecordAnswer(context.Background(), 7, 100, option)
		if !errors.Is(err, ErrInvalidOption) {
			t.Errorf("option %d: expected ErrInvalidOption, got %v", option, err)
		}
		if repo.recordCalls != 0 || len(rater.calls) != 0 {
			t.Errorf("option %d: invalid input reached storage/rater", option)
		}
	}
}

// 6. FSRS-рейтинг упал — это non-fatal: ответ всё равно успешен.
func TestRecordAnswer_RatingErrorIsNonFatal(t *testing.T) {
	repo := &fakeRepo{
		question: quizQuestion(1, int64Ptr(42)),
		rows:     1,
	}
	rater := &fakeRater{err: errors.New("fsrs down")}
	svc := NewService(repo, rater)

	res, err := svc.RecordAnswer(context.Background(), 7, 100, 1)
	if err != nil {
		t.Fatalf("rating failure must be non-fatal, got error: %v", err)
	}
	if !res.Correct {
		t.Fatal("expected Correct=true despite rating error")
	}
	if len(rater.calls) != 1 {
		t.Fatalf("expected rater to be attempted, got %d calls", len(rater.calls))
	}
}

// 7. Граница корректности: option==correct → true; option+1 → false.
func TestRecordAnswer_CorrectnessBoundary(t *testing.T) {
	const correctOption = 2
	repo := &fakeRepo{
		question: quizQuestion(correctOption, int64Ptr(42)),
		rows:     1,
	}
	rater := &fakeRater{}
	svc := NewService(repo, rater)

	// Ровно правильный индекс.
	res, err := svc.RecordAnswer(context.Background(), 7, 100, correctOption)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Correct {
		t.Fatalf("option==correct_option should be correct")
	}

	// Соседний индекс — уже неверный (off-by-one).
	res, err = svc.RecordAnswer(context.Background(), 7, 100, correctOption+1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Correct {
		t.Fatalf("option==correct_option+1 should be incorrect")
	}
}
