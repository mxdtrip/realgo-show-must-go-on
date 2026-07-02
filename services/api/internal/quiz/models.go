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
	Explanation   *string
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
