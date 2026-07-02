package cards

// createCardRequest is the body for POST /me/cards.
type createCardRequest struct {
	Type        string  `json:"type"`
	Question    string  `json:"question"`
	Answer      string  `json:"answer"`
	Explanation *string `json:"explanation"`
	Source      *string `json:"source"`
	ProblemID   *int64  `json:"problem_id"`
	PatternID   *int64  `json:"pattern_id"`
}

// updateCardRequest is the body for PATCH /me/cards/{id}.
type updateCardRequest struct {
	Type        *string `json:"type"`
	Question    *string `json:"question"`
	Answer      *string `json:"answer"`
	Explanation *string `json:"explanation"`
	Source      *string `json:"source"`
}

// cardDetail is returned by GET /me/cards/{id} and mutating operations.
type cardDetail struct {
	ID           int64   `json:"id"`
	Type         string  `json:"type"`
	Question     string  `json:"question"`
	Answer       string  `json:"answer"`
	Explanation  *string `json:"explanation"`
	Source       *string `json:"source"`
	CreatedByAI  bool    `json:"created_by_ai"`
	CreatedAt    string  `json:"created_at"`
	ProblemTitle *string `json:"problem_title"`
	ProblemURL   *string `json:"problem_url"`
	PatternName  *string `json:"pattern_name"`
}
