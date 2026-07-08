package ai

type AssistantRole string

const (
	AssistantRoleUser      AssistantRole = "user"
	AssistantRoleAssistant AssistantRole = "assistant"
)

// AssistantHintRequest describes one hint turn from the browser extension.
type AssistantHintRequest struct {
	Platform         string             `json:"platform"`
	TaskTitle        string             `json:"taskTitle"`
	TaskURL          string             `json:"taskUrl"`
	PlatformTaskSlug string             `json:"platformTaskSlug"`
	Difficulty       string             `json:"difficulty"`
	Tags             []string           `json:"tags"`
	Message          string             `json:"message"`
	HintLevel        int                `json:"hintLevel"`
	History          []AssistantMessage `json:"history"`
}

// AssistantMessage is a compact conversation item. Only the last few turns are
// accepted by the handler; this is context, not durable chat history.
type AssistantMessage struct {
	Role    AssistantRole `json:"role"`
	Content string        `json:"content"`
}

// AssistantPattern is the known taxonomy context for this problem, when the
// problem exists in the catalog.
type AssistantPattern struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Tier     string `json:"tier,omitempty"`
	Families string `json:"families,omitempty"`
}

// AssistantHintInput is the provider-facing shape after validation and DB
// enrichment.
type AssistantHintInput struct {
	Platform      string
	Slug          string
	Title         string
	URL           string
	Difficulty    string
	Tags          []string
	Message       string
	HintLevel     int
	History       []AssistantMessage
	ProblemKnown  bool
	ProblemID     int64
	Patterns      []AssistantPattern
	PromptVersion string
}

// AssistantHintResponse is returned to the extension.
type AssistantHintResponse struct {
	Hint         string             `json:"hint"`
	Question     string             `json:"question,omitempty"`
	Stage        string             `json:"stage"`
	ProblemKnown bool               `json:"problemKnown"`
	Patterns     []AssistantPattern `json:"patterns,omitempty"`
}

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
