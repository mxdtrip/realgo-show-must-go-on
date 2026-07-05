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
)

type GeminiProvider struct {
	apiKey string
	model  string
	url    string
	client *http.Client
}

func NewGeminiProvider(apiKey, model, baseURL string) *GeminiProvider {
	if baseURL == "" {
		baseURL = "https://generativelanguage.googleapis.com/v1beta/openai/"
	}
	return &GeminiProvider{
		apiKey: apiKey,
		model:  model,
		url:    strings.TrimRight(baseURL, "/") + "/chat/completions",
		client: &http.Client{Timeout: 25 * time.Second},
	}
}

func (p *GeminiProvider) Name() string { return "gemini" }

func (p *GeminiProvider) Model() string { return p.model }

func (p *GeminiProvider) GenerateCards(ctx context.Context, in ProblemPromptInput) (GenerateCardsResult, error) {
	if p == nil || p.apiKey == "" {
		return GenerateCardsResult{}, ErrProviderUnavailable
	}
	systemPrompt, userPrompt, err := buildGenerateCardsPrompt(in)
	if err != nil {
		return GenerateCardsResult{}, err
	}

	payload := chatCompletionRequest{
		Model: p.model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: 0.2,
	}
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(payload); err != nil {
		return GenerateCardsResult{}, fmt.Errorf("ai: encode gemini request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.url, &buf)
	if err != nil {
		return GenerateCardsResult{}, fmt.Errorf("ai: create gemini request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return GenerateCardsResult{}, fmt.Errorf("ai: call gemini: %w", err)
	}
	defer func() {
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return GenerateCardsResult{}, fmt.Errorf("ai: gemini status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var out chatCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return GenerateCardsResult{}, fmt.Errorf("ai: decode gemini response: %w", err)
	}
	if len(out.Choices) == 0 || strings.TrimSpace(out.Choices[0].Message.Content) == "" {
		return GenerateCardsResult{}, ErrInvalidResponse
	}
	cards, err := parseCardsResponse(out.Choices[0].Message.Content)
	if err != nil {
		return GenerateCardsResult{}, err
	}
	return GenerateCardsResult{Cards: cards}, nil
}

type chatCompletionRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}
