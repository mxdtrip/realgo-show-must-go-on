package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mxdtrip/freeburger/services/api/internal/config"
)

const requestTimeout = 45 * time.Second

// chatMaxAttempts bounds retries on transient upstream failures (429/5xx):
// the first call plus this many extra attempts, with exponential backoff.
const chatMaxAttempts = 3

// chatRetryBaseDelay is GeminiProvider.retryDelay's default: the backoff
// before the first retry, doubling each subsequent attempt.
const chatRetryBaseDelay = 400 * time.Millisecond

// Card content limits are a defense-in-depth backstop, not the primary
// contract (the prompt already instructs a short answer/explanation): they
// exist to reject a malformed or run-on model reply before it reaches
// Postgres, independent of whatever the prompt says today.
const (
	maxCardQuestionRunes    = 500
	maxCardAnswerRunes      = 800
	maxCardExplanationRunes = 500
)

// requiredCardTypes is the exact set (order-independent) the prompt commits
// to producing — see "## Состав" in prompts/generate_cards_v1.md.
var requiredCardTypes = []string{"pattern_recognition", "algorithm_mechanics", "edge_case"}

// GeminiProvider calls Gemini's OpenAI-compatible chat completions endpoint
// (see config.AI) using the generate_cards_v1 prompt.
type GeminiProvider struct {
	apiKey     string
	model      string
	baseURL    string
	httpClient *http.Client
	// retryDelay is the base backoff delay for chat()'s 429/5xx retries.
	// Defaults to chatRetryBaseDelay; tests shrink it to keep runtime short.
	retryDelay time.Duration
}

// NewGeminiProvider builds a Provider from the loaded AI config. Callers must
// check cfg.Enabled() before using it in production; the zero-key case is not
// guarded here because wiring is responsible for skipping construction.
func NewGeminiProvider(cfg config.AI) *GeminiProvider {
	return &GeminiProvider{
		apiKey:     cfg.APIKey,
		model:      cfg.Model,
		baseURL:    strings.TrimRight(cfg.BaseURL, "/"),
		httpClient: &http.Client{Timeout: requestTimeout},
		retryDelay: chatRetryBaseDelay,
	}
}

func (p *GeminiProvider) PromptVersion() string { return PromptVersionV1 }

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
}

type chatCompletionStreamRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
	Stream   bool          `json:"stream"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}

type chatCompletionChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
}

func (p *GeminiProvider) ModelName() string { return p.model }

// GenerateCards asks the model for the three-card batch and strictly
// validates the reply (see parseGenerationContent). A reply that fails
// validation (bad JSON, wrong card count/types, empty or oversized fields)
// gets exactly one retry with feedback describing what was wrong — the
// model's own bad reply plus the failure become extra turns in the same
// conversation — before giving up; an invalid batch is never persisted.
func (p *GeminiProvider) GenerateCards(ctx context.Context, in GenerateCardsInput) ([]GeneratedCard, error) {
	userContent, err := renderPromptUser(promptUserTmplV1, in)
	if err != nil {
		return nil, err
	}

	messages := []chatMessage{
		{Role: "system", Content: promptSystemV1},
		{Role: "user", Content: userContent},
	}

	content, err := p.chat(ctx, messages)
	if err != nil {
		return nil, err
	}

	cards, parseErr := parseGenerationContent(content)
	if parseErr == nil || errors.Is(parseErr, ErrUnknownProblem) {
		return cards, parseErr
	}

	messages = append(messages,
		chatMessage{Role: "assistant", Content: content},
		chatMessage{Role: "user", Content: invalidCardsFeedback(parseErr)},
	)
	content, err = p.chat(ctx, messages)
	if err != nil {
		return nil, err
	}
	return parseGenerationContent(content)
}

// invalidCardsFeedback builds the retry turn telling the model what was
// wrong with its previous reply, so the retry can actually self-correct
// instead of repeating the same mistake.
func invalidCardsFeedback(err error) string {
	return fmt.Sprintf(
		"Твой предыдущий ответ не прошёл проверку: %s. Верни ИСКЛЮЧИТЕЛЬНО валидный JSON "+
			"по формату из системной инструкции: либо массив ровно из трёх карточек "+
			"(pattern_recognition, algorithm_mechanics, edge_case — каждый тип один раз, "+
			"question и answer непустые, без markdown-обёртки), либо {\"error\":\"unknown_problem\"}.",
		err,
	)
}

func (p *GeminiProvider) GenerateHint(ctx context.Context, in AssistantHintInput) (AssistantHintResponse, error) {
	userContent, err := renderAssistantPromptUser(assistantPromptUserTmplV1, in)
	if err != nil {
		return AssistantHintResponse{}, err
	}

	content, err := p.chat(ctx, []chatMessage{
		{Role: "system", Content: assistantPromptSystemV1},
		{Role: "user", Content: userContent},
	})
	if err != nil {
		return AssistantHintResponse{}, err
	}

	out, err := parseAssistantHintContent(content)
	if err != nil {
		return AssistantHintResponse{}, err
	}
	applyHintLevel(&out, in.HintLevel)
	out.ProblemKnown = in.ProblemKnown
	out.Patterns = in.Patterns
	return out, nil
}

// StreamHint behaves like GenerateHint but calls onDelta with newly revealed
// fragments of the "hint" field as the model streams its JSON reply, so the
// extension can show the hint as it's generated instead of waiting for the
// full response.
func (p *GeminiProvider) StreamHint(ctx context.Context, in AssistantHintInput, onDelta func(string)) (AssistantHintResponse, error) {
	userContent, err := renderAssistantPromptUser(assistantPromptUserTmplV1, in)
	if err != nil {
		return AssistantHintResponse{}, err
	}

	content, err := p.chatStream(ctx, []chatMessage{
		{Role: "system", Content: assistantPromptSystemV1},
		{Role: "user", Content: userContent},
	}, onDelta)
	if err != nil {
		return AssistantHintResponse{}, err
	}

	out, err := parseAssistantHintContent(content)
	if err != nil {
		return AssistantHintResponse{}, err
	}
	applyHintLevel(&out, in.HintLevel)
	out.ProblemKnown = in.ProblemKnown
	out.Patterns = in.Patterns
	return out, nil
}

// chatStream is like chat but requests a streamed (SSE) completion, invoking
// onDelta with decoded fragments of the "hint" field's value as they arrive.
// It returns the full accumulated content once the stream ends, exactly as
// chat would, so callers can parse it the same way.
func (p *GeminiProvider) chatStream(ctx context.Context, messages []chatMessage, onDelta func(string)) (string, error) {
	reqBody, err := json.Marshal(chatCompletionStreamRequest{
		Model:    p.model,
		Messages: messages,
		Stream:   true,
	})
	if err != nil {
		return "", fmt.Errorf("ai: encode gemini stream request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/chat/completions", bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("ai: build gemini stream request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	httpReq.Header.Set("User-Agent", "realgo-assistant/1.0 (+https://realgo.dev)")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("ai: call gemini: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusTooManyRequests {
		return "", ErrQuotaExceeded
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		const maxLoggedBody = 2000
		bodyStr := string(body)
		if len(bodyStr) > maxLoggedBody {
			bodyStr = bodyStr[:maxLoggedBody] + "...(truncated)"
		}
		return "", &APIError{StatusCode: resp.StatusCode, Body: bodyStr}
	}

	extractor := newHintFieldExtractor()
	var full strings.Builder

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		data, ok := strings.CutPrefix(line, "data: ")
		if !ok {
			continue
		}
		if data == "[DONE]" {
			break
		}
		var chunk chatCompletionChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue // skip malformed/keep-alive lines rather than failing the whole stream
		}
		if len(chunk.Choices) == 0 {
			continue
		}
		delta := chunk.Choices[0].Delta.Content
		if delta == "" {
			continue
		}
		full.WriteString(delta)
		if revealed := extractor.feed(delta); revealed != "" && onDelta != nil {
			onDelta(revealed)
		}
	}
	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("ai: read gemini stream: %w", err)
	}

	return full.String(), nil
}

// chat calls doChat, retrying on transient upstream failures (429/5xx) with
// exponential backoff, up to chatMaxAttempts total attempts. Any other error
// (network failure, non-retryable status, malformed response) returns
// immediately.
func (p *GeminiProvider) chat(ctx context.Context, messages []chatMessage) (string, error) {
	var lastErr error
	for attempt := 0; attempt < chatMaxAttempts; attempt++ {
		if attempt > 0 {
			delay := p.retryDelay * time.Duration(1<<uint(attempt-1))
			select {
			case <-time.After(delay):
			case <-ctx.Done():
				return "", ctx.Err()
			}
		}

		content, err := p.doChat(ctx, messages)
		if err == nil {
			return content, nil
		}
		lastErr = err
		if !isRetryableChatError(err) {
			return "", err
		}
	}
	return "", lastErr
}

// isRetryableChatError reports whether err represents a transient upstream
// failure (429 or 5xx) worth retrying, as opposed to a client-side/permanent
// failure (4xx other than 429, network setup error, etc.).
func isRetryableChatError(err error) bool {
	if errors.Is(err, ErrQuotaExceeded) {
		return true
	}
	var apiErr *APIError
	return errors.As(err, &apiErr) && apiErr.StatusCode >= 500
}

func (p *GeminiProvider) doChat(ctx context.Context, messages []chatMessage) (string, error) {
	reqBody, err := json.Marshal(chatCompletionRequest{
		Model:    p.model,
		Messages: messages,
	})
	if err != nil {
		return "", fmt.Errorf("ai: encode gemini request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/chat/completions", bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("ai: build gemini request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	// Go's default "Go-http-client/1.1" User-Agent is a common Cloudflare Bot
	// Management signature; we saw Cloudflare 403 our traffic with a fresh
	// __cf_bm cookie (i.e. classified as a bot before reaching Groq's origin
	// at all) using that default. A descriptive, non-generic UA is the
	// standard fix API providers ask for (same reasoning as GitHub's API
	// requiring one).
	httpReq.Header.Set("User-Agent", "realgo-assistant/1.0 (+https://realgo.dev)")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("ai: call gemini: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusTooManyRequests {
		return "", ErrQuotaExceeded
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		const maxLoggedBody = 2000 // cap so a verbose HTML/JSON error page doesn't flood the log
		bodyStr := string(body)
		if len(bodyStr) > maxLoggedBody {
			bodyStr = bodyStr[:maxLoggedBody] + "...(truncated)"
		}
		return "", &APIError{StatusCode: resp.StatusCode, Body: bodyStr}
	}

	var completion chatCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&completion); err != nil {
		return "", fmt.Errorf("ai: decode gemini response: %w", err)
	}
	if len(completion.Choices) == 0 {
		return "", fmt.Errorf("ai: gemini returned no choices")
	}
	return completion.Choices[0].Message.Content, nil
}

type generatedCardJSON struct {
	Type        string `json:"type"`
	Question    string `json:"question"`
	Answer      string `json:"answer"`
	Explanation string `json:"explanation"`
}

type refusalJSON struct {
	Error string `json:"error"`
}

// parseGenerationContent parses the model's strict-JSON reply: either an
// array of exactly three cards (one each of requiredCardTypes, matching the
// cards.type CHECK constraint) passing validateGeneratedCards, or a
// {"error":"unknown_problem"} refusal.
func parseGenerationContent(content string) ([]GeneratedCard, error) {
	trimmed := strings.TrimSpace(content)

	if strings.HasPrefix(trimmed, "[") {
		var raw []generatedCardJSON
		if err := json.Unmarshal([]byte(trimmed), &raw); err != nil {
			return nil, fmt.Errorf("ai: parse cards json: %w", err)
		}
		if err := validateGeneratedCards(raw); err != nil {
			return nil, err
		}
		cards := make([]GeneratedCard, 0, len(raw))
		for _, c := range raw {
			cards = append(cards, GeneratedCard(c))
		}
		return cards, nil
	}

	var refusal refusalJSON
	if err := json.Unmarshal([]byte(trimmed), &refusal); err != nil {
		return nil, fmt.Errorf("ai: parse model response: %w", err)
	}
	if refusal.Error == "unknown_problem" {
		return nil, ErrUnknownProblem
	}
	return nil, fmt.Errorf("ai: unexpected model response: %s", trimmed)
}

// validateGeneratedCards enforces the strict card-generation contract:
// exactly one card per requiredCardTypes entry, non-empty question/answer,
// and length backstops on question/answer/explanation. Garbage that fails
// here is never passed on to a caller that would persist it.
func validateGeneratedCards(raw []generatedCardJSON) error {
	if len(raw) != len(requiredCardTypes) {
		return fmt.Errorf("ai: model returned %d cards, want exactly %d", len(raw), len(requiredCardTypes))
	}

	seen := make(map[string]bool, len(requiredCardTypes))
	for _, c := range raw {
		if !isRequiredCardType(c.Type) {
			return fmt.Errorf("ai: unexpected card type %q", c.Type)
		}
		if seen[c.Type] {
			return fmt.Errorf("ai: duplicate card type %q", c.Type)
		}
		seen[c.Type] = true

		if strings.TrimSpace(c.Question) == "" {
			return fmt.Errorf("ai: card %q has an empty question", c.Type)
		}
		if strings.TrimSpace(c.Answer) == "" {
			return fmt.Errorf("ai: card %q has an empty answer", c.Type)
		}
		if n := utf8.RuneCountInString(c.Question); n > maxCardQuestionRunes {
			return fmt.Errorf("ai: card %q question too long (%d runes, max %d)", c.Type, n, maxCardQuestionRunes)
		}
		if n := utf8.RuneCountInString(c.Answer); n > maxCardAnswerRunes {
			return fmt.Errorf("ai: card %q answer too long (%d runes, max %d)", c.Type, n, maxCardAnswerRunes)
		}
		if n := utf8.RuneCountInString(c.Explanation); n > maxCardExplanationRunes {
			return fmt.Errorf("ai: card %q explanation too long (%d runes, max %d)", c.Type, n, maxCardExplanationRunes)
		}
	}

	for _, want := range requiredCardTypes {
		if !seen[want] {
			return fmt.Errorf("ai: missing required card type %q", want)
		}
	}
	return nil
}

func isRequiredCardType(t string) bool {
	for _, want := range requiredCardTypes {
		if t == want {
			return true
		}
	}
	return false
}

type assistantHintJSON struct {
	Hint     string `json:"hint"`
	Question string `json:"question"`
	Stage    string `json:"stage"`
}

func parseAssistantHintContent(content string) (AssistantHintResponse, error) {
	trimmed := strings.TrimSpace(content)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)

	var raw assistantHintJSON
	if err := json.Unmarshal([]byte(trimmed), &raw); err != nil {
		return AssistantHintResponse{}, fmt.Errorf("ai: parse assistant hint json: %w", err)
	}
	raw.Hint = strings.TrimSpace(raw.Hint)
	raw.Question = strings.TrimSpace(raw.Question)
	raw.Stage = strings.TrimSpace(raw.Stage)
	if raw.Hint == "" {
		return AssistantHintResponse{}, fmt.Errorf("ai: assistant hint is empty")
	}
	if !validAssistantStage(raw.Stage) {
		raw.Stage = defaultAssistantStage
	}
	return AssistantHintResponse{
		Hint:     raw.Hint,
		Question: raw.Question,
		Stage:    raw.Stage,
	}, nil
}

// defaultAssistantStage is used when the model's "stage" field is missing or
// doesn't match one of the three hint levels (see prompts/assistant_hint_v1.md).
const defaultAssistantStage = "nudge"

func validAssistantStage(stage string) bool {
	switch stage {
	case "nudge", "approach", "reveal":
		return true
	default:
		return false
	}
}

// applyHintLevel makes the level -> stage mapping authoritative on our side
// instead of trusting the model's self-reported "stage" field: live testing
// showed the model sometimes mislabels a level-3 reply as "approach" (or
// tacks a trailing question onto it despite the prompt forbidding that at
// the final level). Overriding here guarantees the client always sees a
// stage consistent with the level it asked for, and that the last of the
// three hints never carries a dangling question.
func applyHintLevel(out *AssistantHintResponse, hintLevel int) {
	switch {
	case hintLevel <= 1:
		out.Stage = "nudge"
	case hintLevel == 2:
		out.Stage = "approach"
	default:
		out.Stage = "reveal"
		out.Question = ""
	}
}
