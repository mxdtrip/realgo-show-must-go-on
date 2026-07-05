package ai

import "errors"

var (
	ErrProviderUnavailable = errors.New("ai provider unavailable")
	ErrInvalidResponse     = errors.New("invalid ai response")
	ErrUnknownProblem      = errors.New("unknown problem")
)

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

type ProblemPromptInput struct {
	Platform   string
	Slug       string
	Title      string
	Difficulty string
	URL        string
}

type GeneratedCard struct {
	Type        string `json:"type"`
	Question    string `json:"question"`
	Answer      string `json:"answer"`
	Explanation string `json:"explanation"`
}

type GenerateCardsResult struct {
	Cards []GeneratedCard
}
