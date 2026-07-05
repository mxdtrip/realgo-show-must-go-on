package ai

// GenerateCardRequest describes the context for card generation.
type GenerateCardRequest struct {
	// Exactly one of ProblemID or PatternID must be set.
	ProblemID *int64 `json:"problem_id"`
	PatternID *int64 `json:"pattern_id"`
	// Optional hint for the type of card to generate.
	CardType string `json:"card_type"`
}

// GenerateQuizRequest describes the context for quiz question generation.
type GenerateQuizRequest struct {
	ProblemID  *int64 `json:"problem_id"`
	PatternID  *int64 `json:"pattern_id"`
	Difficulty string `json:"difficulty"`
}
