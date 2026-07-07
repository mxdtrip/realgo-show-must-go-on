package quiz

import (
	"context"
	"errors"
	"testing"
)

// Эти тесты — белым ящиком (package quiz), чтобы фейки могли реализовать
// непубличные consumer-side интерфейсы Service (repository, ConfidenceUpdater)
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

type fakeConfidence struct {
	calls []fakeConfidenceCall
	err   error
}

type fakeConfidenceCall struct {
	UserID    int64
	ProblemID int64
	Rating    string
}

func (f *fakeConfidence) UpdateProgressConfidence(_ context.Context, userID, problemID int64, rating string) error {
	f.calls = append(f.calls, fakeConfidenceCall{UserID: userID, ProblemID: problemID, Rating: rating})
	return f.err
}

func int64Ptr(v int64) *int64 { return &v }

// --- tests ---

// 1. ProblemID задан, верный ответ → Correct=true, confidence обновлён как "easy".
func TestRecordAnswer_CorrectAnswer_UpdatesConfidenceEasy(t *testing.T) {
	repo := &fakeRepo{
		question: questionDetail{CorrectOption: 1, ProblemID: int64Ptr(42)},
		rows:     1,
	}
	conf := &fakeConfidence{}
	svc := NewService(repo, conf)

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
	if len(conf.calls) != 1 {
		t.Fatalf("expected 1 confidence call, got %d", len(conf.calls))
	}
	if conf.calls[0].Rating != "easy" {
		t.Fatalf("expected rating easy, got %q", conf.calls[0].Rating)
	}
	if conf.calls[0].ProblemID != 42 || conf.calls[0].UserID != 7 {
		t.Fatalf("unexpected confidence call: %+v", conf.calls[0])
	}
	if repo.lastRecord.WasCorrect != true {
		t.Fatal("expected answer recorded as correct")
	}
}

// 2. ProblemID задан, неверный ответ → Correct=false, confidence обновлён как "hard".
func TestRecordAnswer_IncorrectAnswer_UpdatesConfidenceHard(t *testing.T) {
	repo := &fakeRepo{
		question: questionDetail{CorrectOption: 1, ProblemID: int64Ptr(42)},
		rows:     1,
	}
	conf := &fakeConfidence{}
	svc := NewService(repo, conf)

	res, err := svc.RecordAnswer(context.Background(), 7, 100, 0) // option 0 ≠ correct 1
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Correct {
		t.Fatal("expected Correct=false")
	}
	if len(conf.calls) != 1 || conf.calls[0].Rating != "hard" {
		t.Fatalf("expected 1 hard confidence call, got %+v", conf.calls)
	}
	if repo.lastRecord.WasCorrect != false {
		t.Fatal("expected answer recorded as incorrect")
	}
}

// 3. ProblemID=nil (вопрос по pattern) → confidence не обновляется.
func TestRecordAnswer_PatternOnly_SkipsConfidence(t *testing.T) {
	repo := &fakeRepo{
		question: questionDetail{CorrectOption: 1, ProblemID: nil}, // pattern-only
		rows:     1,
	}
	conf := &fakeConfidence{}
	svc := NewService(repo, conf)

	if _, err := svc.RecordAnswer(context.Background(), 7, 100, 1); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(conf.calls) != 0 {
		t.Fatalf("expected no confidence calls for pattern-only question, got %d", len(conf.calls))
	}
}

// 4. Вопрос не найден → ErrQuestionNotFound; ответ и confidence не вызываются.
func TestRecordAnswer_QuestionNotFound(t *testing.T) {
	repo := &fakeRepo{
		getErr: errNotFound,
		rows:   1,
	}
	conf := &fakeConfidence{}
	svc := NewService(repo, conf)

	_, err := svc.RecordAnswer(context.Background(), 7, 100, 1)
	if !errors.Is(err, ErrQuestionNotFound) {
		t.Fatalf("expected ErrQuestionNotFound, got %v", err)
	}
	if repo.recordCalls != 0 {
		t.Fatalf("expected RecordAnswer not called, got %d calls", repo.recordCalls)
	}
	if len(conf.calls) != 0 {
		t.Fatalf("expected no confidence calls, got %d", len(conf.calls))
	}
}

// 5. Повторный ответ (rows=0) → ErrAlreadyAnswered; confidence не вызывается.
func TestRecordAnswer_AlreadyAnswered(t *testing.T) {
	repo := &fakeRepo{
		question: questionDetail{CorrectOption: 1, ProblemID: int64Ptr(42)},
		rows:     0, // анти-чит: пара уже существует
	}
	conf := &fakeConfidence{}
	svc := NewService(repo, conf)

	_, err := svc.RecordAnswer(context.Background(), 7, 100, 1)
	if !errors.Is(err, ErrAlreadyAnswered) {
		t.Fatalf("expected ErrAlreadyAnswered, got %v", err)
	}
	if len(conf.calls) != 0 {
		t.Fatalf("expected no confidence calls on replay, got %d", len(conf.calls))
	}
}

// 6. Confidence-обновление упало — это non-fatal: ответ всё равно успешен.
func TestRecordAnswer_ConfidenceErrorIsNonFatal(t *testing.T) {
	repo := &fakeRepo{
		question: questionDetail{CorrectOption: 1, ProblemID: int64Ptr(42)},
		rows:     1,
	}
	conf := &fakeConfidence{err: errors.New("db down")}
	svc := NewService(repo, conf)

	res, err := svc.RecordAnswer(context.Background(), 7, 100, 1)
	if err != nil {
		t.Fatalf("confidence failure must be non-fatal, got error: %v", err)
	}
	if !res.Correct {
		t.Fatal("expected Correct=true despite confidence error")
	}
	if len(conf.calls) != 1 {
		t.Fatalf("expected confidence to be attempted, got %d calls", len(conf.calls))
	}
}

// 7. Граница корректности: option==correct → true; option+1 → false.
func TestRecordAnswer_CorrectnessBoundary(t *testing.T) {
	const correctOption = 2
	repo := &fakeRepo{
		question: questionDetail{CorrectOption: correctOption, ProblemID: int64Ptr(42)},
		rows:     1,
	}
	conf := &fakeConfidence{}
	svc := NewService(repo, conf)

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
