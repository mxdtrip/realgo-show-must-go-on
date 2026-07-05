package ai

import (
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

type chatCompletionResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}

func (p *GeminiProvider) GenerateCards(ctx context.Context, in GenerateCardsInput) ([]GeneratedCard, error) {
	userContent, err := renderPromptUser(promptUserTmplV1, in)
	if err != nil {
		return nil, err
	}

	reqBody, err := json.Marshal(chatCompletionRequest{
		Model: p.model,
		Messages: []chatMessage{
			{Role: "system", Content: promptSystemV1},
			{Role: "user", Content: userContent},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("ai: encode gemini request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/chat/completions", bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("ai: build gemini request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ai: call gemini: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, ErrQuotaExceeded
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ai: gemini responded %d: %s", resp.StatusCode, string(body))
	}

	var completion chatCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&completion); err != nil {
		return nil, fmt.Errorf("ai: decode gemini response: %w", err)
	}
	if len(completion.Choices) == 0 {
		return nil, fmt.Errorf("ai: gemini returned no choices")
	}

	return parseGenerationContent(completion.Choices[0].Message.Content)
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
			cards = append(cards, GeneratedCard{
				Type:        c.Type,
				Question:    c.Question,
				Answer:      c.Answer,
				Explanation: c.Explanation,
			})
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
