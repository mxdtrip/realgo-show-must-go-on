package ai

import (
	"bytes"
	_ "embed"
	"fmt"
	"strings"
	"text/template"
)

//go:embed prompts/generate_cards_v1.md
var generateCardsPromptV1 string

func buildGenerateCardsPrompt(in ProblemPromptInput) (systemPrompt, userPrompt string, err error) {
	systemPrompt, userTemplate, err := splitPrompt(generateCardsPromptV1)
	if err != nil {
		return "", "", err
	}
	tpl, err := template.New("generate_cards_v1").Parse(userTemplate)
	if err != nil {
		return "", "", fmt.Errorf("ai: parse card prompt: %w", err)
	}
	var buf bytes.Buffer
	if err := tpl.Execute(&buf, in); err != nil {
		return "", "", fmt.Errorf("ai: render card prompt: %w", err)
	}
	return systemPrompt, strings.TrimSpace(buf.String()), nil
}

func splitPrompt(raw string) (string, string, error) {
	_, afterSystem, ok := strings.Cut(raw, "<!-- system -->")
	if !ok {
		return "", "", fmt.Errorf("ai: card prompt missing system marker")
	}
	systemPrompt, userPrompt, ok := strings.Cut(afterSystem, "<!-- user -->")
	if !ok {
		return "", "", fmt.Errorf("ai: card prompt missing user marker")
	}
	return strings.TrimSpace(systemPrompt), strings.TrimSpace(userPrompt), nil
}
