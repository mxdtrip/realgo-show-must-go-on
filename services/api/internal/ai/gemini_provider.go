package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/config"
)

const requestTimeout = 45 * time.Second

// GeminiProvider calls Gemini's OpenAI-compatible chat completions endpoint
// (see config.AI) using the generate_cards_v1 prompt.
type GeminiProvider struct {
	apiKey     string
	model      string
	baseURL    string
	httpClient *http.Client
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

func (p *GeminiProvider) GenerateCards(ctx context.Context, in GenerateCardsInput) ([]GeneratedCard, error) {
	userContent, err := renderPromptUser(promptUserTmplV1, in)
	if err != nil {
		return nil, err
	}

	content, err := p.chat(ctx, []chatMessage{
		{Role: "system", Content: promptSystemV1},
		{Role: "user", Content: userContent},
	})
	if err != nil {
		return nil, err
	}

	return parseGenerationContent(content)
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

func (p *GeminiProvider) chat(ctx context.Context, messages []chatMessage) (string, error) {
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
// array of exactly three cards, or a {"error":"unknown_problem"} refusal.
func parseGenerationContent(content string) ([]GeneratedCard, error) {
	trimmed := strings.TrimSpace(content)

	if strings.HasPrefix(trimmed, "[") {
		var raw []generatedCardJSON
		if err := json.Unmarshal([]byte(trimmed), &raw); err != nil {
			return nil, fmt.Errorf("ai: parse cards json: %w", err)
		}
		if len(raw) == 0 {
			return nil, fmt.Errorf("ai: model returned an empty cards array")
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
		raw.Stage = "nudge"
	}
	return AssistantHintResponse{
		Hint:     raw.Hint,
		Question: raw.Question,
		Stage:    raw.Stage,
	}, nil
}

func validAssistantStage(stage string) bool {
	switch stage {
	case "nudge", "pattern", "invariant", "next_step", "debug":
		return true
	default:
		return false
	}
}
