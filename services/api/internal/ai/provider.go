package ai

import (
	"context"
	"errors"
	"fmt"
)

// ErrUnknownProblem is returned when the model cannot confidently identify
// the problem from platform/slug/title and refuses rather than guessing.
var ErrUnknownProblem = errors.New("ai: unknown_problem")

// ErrQuotaExceeded is returned when the provider rejects the request because
// the configured quota/rate limit was hit.
var ErrQuotaExceeded = errors.New("ai: quota_exceeded")

// ErrProblemNotFound is returned when a card-generation request targets a
// problem_id that doesn't exist in the catalog.
var ErrProblemNotFound = errors.New("ai: problem not found")

// APIError wraps a non-2xx response from the upstream Gemini API so callers
// can log the status code and response body separately from the generic
// error string. This is what tells "GEMINI_API_KEY missing" apart from
// "key present but Google rejected the request" (e.g. 403 PERMISSION_DENIED
// with a "User location is not supported" message — the geo-block case) or a
// transient 5xx on Google's side.
type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("ai: provider responded %d: %s", e.StatusCode, e.Body)
}

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
	ProviderName() string
	ModelName() string
	// PromptVersion identifies the prompt revision used, stored on generated
	// cards (cards.ai_prompt_version) to invalidate stale batches when the
	// prompt materially changes.
	PromptVersion() string
}

// HintProvider generates one guided, non-solution hint for the extension
// assistant. Implementations must keep API keys server-side.
type HintProvider interface {
	GenerateHint(ctx context.Context, in AssistantHintInput) (AssistantHintResponse, error)
	// StreamHint behaves like GenerateHint but additionally invokes onDelta
	// with newly available fragments of the hint text as the model generates
	// them, so callers can render it incrementally instead of waiting for the
	// full response.
	StreamHint(ctx context.Context, in AssistantHintInput, onDelta func(text string)) (AssistantHintResponse, error)
	ProviderName() string
	ModelName() string
}
