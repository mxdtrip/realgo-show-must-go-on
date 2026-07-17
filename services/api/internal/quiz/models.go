package quiz

import "time"

type sessionQuestion struct {
	ID           int64
	Question     string
	Options      []string
	Difficulty   *string
	CreatedByAI  bool
	CreatedAt    *time.Time
	ProblemID    *int64
	ProblemTitle *string
	PatternID    *int64
	PatternName  *string
}

type questionDetail struct {
	CorrectOption int
	OptionCount   int
	Explanation   *string
	// ProblemID непуст, только если вопрос привязан к problem (а не к pattern).
	// Нужен сервису, чтобы обновить confidence и (позже) прогнать FSRS.
	ProblemID *int64
}

type questionItem struct {
	ID           int64    `json:"id"`
	Question     string   `json:"question"`
	Options      []string `json:"options"`
	Difficulty   *string  `json:"difficulty"`
	CreatedByAI  bool     `json:"created_by_ai"`
	CreatedAt    string   `json:"created_at"`
	ProblemID    *int64   `json:"problem_id"`
	ProblemTitle *string  `json:"problem_title"`
	PatternID    *int64   `json:"pattern_id"`
	PatternName  *string  `json:"pattern_name"`
}

type answerRequest struct {
	Option int `json:"option"`
}

type answerResult struct {
	Correct       bool    `json:"correct"`
	CorrectOption int     `json:"correct_option"`
	Explanation   *string `json:"explanation"`
}

func questionItemFromSessionQuestion(q sessionQuestion) questionItem {
	item := questionItem{
		ID:           q.ID,
		Question:     q.Question,
		Options:      q.Options,
		Difficulty:   q.Difficulty,
		CreatedByAI:  q.CreatedByAI,
		ProblemID:    q.ProblemID,
		ProblemTitle: q.ProblemTitle,
		PatternID:    q.PatternID,
		PatternName:  q.PatternName,
	}
	if item.Options == nil {
		item.Options = []string{}
	}
	if q.CreatedAt != nil {
		item.CreatedAt = q.CreatedAt.UTC().Format(time.RFC3339)
	}
	return item
}
