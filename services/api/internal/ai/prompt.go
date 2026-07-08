package ai

import (
	_ "embed"
	"fmt"
	"strings"
	"text/template"
)

//go:embed prompts/generate_cards_v1.md
var promptDocV1 string

//go:embed prompts/assistant_hint_v1.md
var assistantPromptDocV1 string

// PromptVersionV1 must be bumped alongside the prompt whenever a change
// alters generation semantics (see prompts/generate_cards_v1.md), so stale
// cards.ai_prompt_version rows are regenerated instead of silently reused.
const PromptVersionV1 = "1"

const AssistantHintPromptVersionV1 = "assistant_hint_v1"

// Anchored to a line of their own: the prompt doc's intro prose also
// mentions the bare marker text inline (inside backticks) to describe the
// convention, so a plain substring search would match that mention instead
// of the real section delimiters below it.
const (
	promptSystemMarker = "\n<!-- system -->\n"
	promptUserMarker   = "\n<!-- user -->\n"
)

var (
	promptSystemV1            string
	promptUserTmplV1          *template.Template
	assistantPromptSystemV1   string
	assistantPromptUserTmplV1 *template.Template
)

func init() {
	system, userTmplSrc, err := splitPrompt(promptDocV1)
	if err != nil {
		panic(fmt.Errorf("ai: parse generate_cards_v1.md: %w", err))
	}
	promptSystemV1 = system
	promptUserTmplV1 = template.Must(template.New("generate_cards_v1_user").Parse(userTmplSrc))

	assistantSystem, assistantUserTmplSrc, err := splitPrompt(assistantPromptDocV1)
	if err != nil {
		panic(fmt.Errorf("ai: parse assistant_hint_v1.md: %w", err))
	}
	assistantPromptSystemV1 = assistantSystem
	assistantPromptUserTmplV1 = template.Must(template.New("assistant_hint_v1_user").Parse(assistantUserTmplSrc))
}

// promptUserData is the Go text/template input for the prompt's user section.
type promptUserData struct {
	Platform   string
	Slug       string
	Title      string
	Difficulty string
	URL        string
}

// splitPrompt separates a prompt document into its system and user sections,
// delimited by the <!-- system --> / <!-- user --> markers.
func splitPrompt(doc string) (system, user string, err error) {
	si := strings.Index(doc, promptSystemMarker)
	ui := strings.Index(doc, promptUserMarker)
	if si == -1 || ui == -1 || ui < si {
		return "", "", fmt.Errorf("missing %q/%q markers", promptSystemMarker, promptUserMarker)
	}
	system = strings.TrimSpace(doc[si+len(promptSystemMarker) : ui])
	user = strings.TrimSpace(doc[ui+len(promptUserMarker):])
	return system, user, nil
}

func renderPromptUser(tmpl *template.Template, in GenerateCardsInput) (string, error) {
	var buf strings.Builder
	if err := tmpl.Execute(&buf, promptUserData(in)); err != nil {
		return "", fmt.Errorf("ai: render prompt: %w", err)
	}
	return buf.String(), nil
}

func renderAssistantPromptUser(tmpl *template.Template, in AssistantHintInput) (string, error) {
	var buf strings.Builder
	if err := tmpl.Execute(&buf, in); err != nil {
		return "", fmt.Errorf("ai: render assistant prompt: %w", err)
	}
	return buf.String(), nil
}
