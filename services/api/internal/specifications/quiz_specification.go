package specifications

import "testing"

// QuizSpecification — north-star AT интеграции Quiz × confidence (Путь B).
//
// Вопросы привязаны к problem (не card): правильный ответ двигает
// user_problem_progress.confidence, повторный ответ отклоняется анти-читом.
// FSRS-планирование пока заглушено (Этап 4), поэтому schedule здесь не проверяем.
func QuizSpecification(t *testing.T, p QuizProvider, s QuizSeeder, c ConfidenceProbe) {
	t.Helper()
	t.Run("quiz", func(t *testing.T) {
		t.Run("correct answer bumps confidence and rejects replay", func(t *testing.T) {
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

			// Вопрос попал в сессию и несёт правильный problem_id.
			session := qu.GetSession(t, 10)
			var found bool
			for _, q := range session.Cards {
				if q.ID == qID {
					found = true
					if q.ProblemID == nil || *q.ProblemID != problemID {
						t.Fatalf("question %d: expected problem_id %d", qID, problemID)
					}
					break
				}
			}
			if !found {
				t.Fatalf("question %d not found in session of %d", qID, len(session.Cards))
			}

			before := c.Confidence(t, uid, problemID)

			res := qu.AnswerQuestion(t, qID, correctOption)
			if !res.Correct {
				t.Fatal("expected correct answer")
			}
			if res.CorrectOption != correctOption {
				t.Fatalf("expected correct_option=%d, got %d", correctOption, res.CorrectOption)
			}

			after := c.Confidence(t, uid, problemID)
			if after == nil {
				t.Fatal("expected confidence to be set after correct answer")
			}
			baseline := 50 // COALESCE(confidence, 50) в UpdateProgressConfidence
			if before != nil {
				baseline = *before
			}
			if want := baseline + 10; *after != want { // correct → "easy" → +10
				t.Fatalf("confidence: expected %d, got %d", want, *after)
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

			before := c.Confidence(t, uid, problemID)

			res := qu.AnswerQuestion(t, qID, 0) // неверный вариант
			if res.Correct {
				t.Fatal("expected incorrect answer")
			}

			after := c.Confidence(t, uid, problemID)
			if after == nil {
				t.Fatal("expected confidence to be set after answer")
			}
			baseline := 50
			if before != nil {
				baseline = *before
			}
			if want := baseline - 10; *after != want { // incorrect → "hard" → -10
				t.Fatalf("confidence: expected %d, got %d", want, *after)
			}
		})
	})
}
