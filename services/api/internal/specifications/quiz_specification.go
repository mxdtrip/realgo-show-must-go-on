package specifications

import (
	"testing"
	"time"
)

// QuizSpecification — north-star AT интеграции Quiz × FSRS (Issue #150).
//
// Вопросы привязаны к problem: ответ засчитывается в spaced-repetition —
// верный ответ (fsrs.Good) отодвигает review_schedules.next_review_at в будущее,
// неверный (fsrs.Hard) — приближает и снижает confidence. Повторный ответ
// отклоняется анти-читом.
func QuizSpecification(t *testing.T, p QuizProvider, s QuizSeeder, probe QuizProbe) {
	t.Helper()
	t.Run("quiz", func(t *testing.T) {
		t.Run("correct answer schedules a future review and rejects replay", func(t *testing.T) {
			email := uniqueEmail(t)
			user := p.Register(t, email, "AcceptanceTest-2026!")
			uid := user.UserID(t)
			qu := p.QuizUser(user)

			problemID := s.CreateProblem(t, uid, "Two Sum",
				"https://leetcode.com/problems/two-sum/", "easy", uniqueSlug(t))
			const correctOption = 1
			qID := s.CreateQuizQuestion(t, uid, problemID,
				"What is the time complexity of the optimal Two Sum solution?",
				[]string{"O(n^2)", "O(n)", "O(n log n)"}, correctOption, "Hash map gives O(n).")

			// До ответа расписания может не быть (создаётся при первом рейтинге).
			beforeDue := probe.NextReviewAt(t, uid, problemID)

			res := qu.AnswerQuestion(t, qID, correctOption)
			if !res.Correct {
				t.Fatal("expected correct answer")
			}
			if res.CorrectOption != correctOption {
				t.Fatalf("expected correct_option=%d, got %d", correctOption, res.CorrectOption)
			}

			// #150: верный ответ засчитан в spaced-repetition — появилось
			// расписание с next_review_at в будущем (FSRS Good).
			afterDue := probe.NextReviewAt(t, uid, problemID)
			if afterDue == nil {
				t.Fatal("expected review schedule after correct answer, got none")
			}
			if !afterDue.After(time.Now().UTC()) {
				t.Fatalf("expected next_review_at in the future, got %v", *afterDue)
			}
			if beforeDue != nil && !afterDue.After(*beforeDue) {
				t.Fatalf("correct answer should push next_review_at forward: before=%v after=%v", *beforeDue, *afterDue)
			}

			// Анти-чит: повторный ответ отклоняется.
			if !qu.AnswerQuestionAgain(t, qID, correctOption) {
				t.Fatal("expected replay to be rejected by anti-cheat")
			}
		})

		t.Run("incorrect answer lowers confidence", func(t *testing.T) {
			email := uniqueEmail(t)
			user := p.Register(t, email, "AcceptanceTest-2026!")
			uid := user.UserID(t)
			qu := p.QuizUser(user)

			problemID := s.CreateProblem(t, uid, "3Sum",
				"https://leetcode.com/problems/3sum/", "medium", uniqueSlug(t))
			const correctOption = 1
			qID := s.CreateQuizQuestion(t, uid, problemID,
				"Which complexity is NOT O(n)?",
				[]string{"linear scan", "binary search", "hash lookup"}, correctOption, "")

			before := probe.Confidence(t, uid, problemID)

			res := qu.AnswerQuestion(t, qID, 0) // неверный вариант
			if res.Correct {
				t.Fatal("expected incorrect answer")
			}

			after := probe.Confidence(t, uid, problemID)
			if after == nil {
				t.Fatal("expected confidence to be set after answer")
			}
			baseline := 50 // COALESCE(confidence, 50) в UpdateProgressConfidence
			if before != nil {
				baseline = *before
			}
			if want := baseline - 10; *after != want { // incorrect → "hard" → −10
				t.Fatalf("confidence: expected %d, got %d", want, *after)
			}
		})
	})
}
