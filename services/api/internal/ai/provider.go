package ai

import (
	"context"
	"errors"
)

// ErrUnknownProblem is returned when the model cannot confidently identify
// the problem from platform/slug/title and refuses rather than guessing.
var ErrUnknownProblem = errors.New("ai: unknown_problem")

// ErrQuotaExceeded is returned when the provider rejects the request because
// the configured quota/rate limit was hit.
var ErrQuotaExceeded = errors.New("ai: quota_exceeded")

// GenerateCardsInput is the problem context fed into the generation prompt.
type GenerateCardsInput struct {
	Platform   string
	Slug       string
	Title      string
	Difficulty string
	URL        string
}

// GeneratedCard is one card produced by a Provider, in DB schema field names.
type GeneratedCard struct {
	Type        string
	Question    string
	Answer      string
	Explanation string
}

// Provider generates study cards for a solved problem. Implementations must
// return ErrUnknownProblem or ErrQuotaExceeded for those specific refusals so
// CardProvisioner can treat them as a "none" outcome rather than a hard error.
type Provider interface {
	GenerateCards(ctx context.Context, in GenerateCardsInput) ([]GeneratedCard, error)
	// PromptVersion identifies the prompt revision used, stored on generated
	// cards (cards.ai_prompt_version) to invalidate stale batches when the
	// prompt materially changes.
	PromptVersion() string
}

// HintProvider generates one guided, non-solution hint for the extension
// assistant. Implementations must keep API keys server-side.
type HintProvider interface {
	GenerateHint(ctx context.Context, in AssistantHintInput) (AssistantHintResponse, error)
	ModelName() string
}
