package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mxdtrip/freeburger/services/api/internal/config"
)

func newTestServer(t *testing.T, status int, body string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func chatCompletionBody(content string) string {
	payload := chatCompletionResponse{
		Choices: []struct {
			Message chatMessage `json:"message"`
		}{{Message: chatMessage{Role: "assistant", Content: content}}},
	}
	raw, _ := json.Marshal(payload)
	return string(raw)
}

func TestGeminiProvider_GenerateCards_Success(t *testing.T) {
	cardsJSON := `[
		{"type":"pattern_recognition","question":"q1","answer":"a1","explanation":"e1"},
		{"type":"algorithm_mechanics","question":"q2","answer":"a2","explanation":"e2"},
		{"type":"edge_case","question":"q3","answer":"a3","explanation":"e3"}
	]`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("missing/incorrect Authorization header: %q", r.Header.Get("Authorization"))
		}
		if r.URL.Path != "/chat/completions" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		var req chatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if len(req.Messages) != 2 || req.Messages[0].Role != "system" || req.Messages[1].Role != "user" {
			t.Fatalf("unexpected messages: %+v", req.Messages)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(chatCompletionBody(cardsJSON)))
	}))
	defer srv.Close()

	p := NewGeminiProvider(config.AI{APIKey: "test-key", Model: "gemini-2.5-flash", BaseURL: srv.URL})
	cards, err := p.GenerateCards(context.Background(), GenerateCardsInput{
		Platform: "leetcode", Slug: "two-sum", Title: "Two Sum", Difficulty: "easy", URL: "https://leetcode.com/problems/two-sum/",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cards) != 3 {
		t.Fatalf("got %d cards, want 3", len(cards))
	}
	if cards[0].Type != "pattern_recognition" || cards[0].Question != "q1" {
		t.Errorf("unexpected first card: %+v", cards[0])
	}
	if p.PromptVersion() != PromptVersionV1 {
		t.Errorf("PromptVersion() = %q, want %q", p.PromptVersion(), PromptVersionV1)
	}
}

func TestGeminiProvider_GenerateHint_Success(t *testing.T) {
	hintJSON := `{"hint":"Посмотри, что надо быстро находить для текущего числа.","question":"Какую информацию о предыдущих элементах стоит хранить?","stage":"approach"}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("missing/incorrect Authorization header: %q", r.Header.Get("Authorization"))
		}
		var req chatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req.Model != "gemini-2.5-flash" {
			t.Fatalf("model = %q", req.Model)
		}
		if len(req.Messages) != 2 || !strings.Contains(req.Messages[1].Content, "Two Sum") {
			t.Fatalf("unexpected messages: %+v", req.Messages)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(chatCompletionBody(hintJSON)))
	}))
	defer srv.Close()

	p := NewGeminiProvider(config.AI{APIKey: "test-key", Model: "gemini-2.5-flash", BaseURL: srv.URL})
	out, err := p.GenerateHint(context.Background(), AssistantHintInput{
		Platform:     "leetcode",
		Slug:         "two-sum",
		Title:        "Two Sum",
		URL:          "https://leetcode.com/problems/two-sum/",
		Difficulty:   "easy",
		Message:      "Я застрял",
		HintLevel:    2,
		ProblemKnown: true,
		Patterns:     []AssistantPattern{{Code: "complement_lookup", Name: "Complement Lookup / Pair Mapping"}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Stage != "approach" || out.Hint == "" || out.Question == "" {
		t.Fatalf("unexpected hint: %+v", out)
	}
	if !out.ProblemKnown || len(out.Patterns) != 1 {
		t.Fatalf("missing enriched context: %+v", out)
	}
}

func TestGeminiProvider_StreamHint_Success(t *testing.T) {
	// Split across multiple SSE chunks, including one that splits a JSON
	// escape sequence ("\\" and "n" in separate chunks) to exercise the
	// extractor's cross-chunk escape-decoding state.
	chunks := []string{
		`{"hint":"Пос`,
		`мотри на паре`,
		`й.\`,
		`n"`,
		`,"question":"Что хранить?","stage":"approach"}`,
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req chatCompletionStreamRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if !req.Stream {
			t.Fatalf("expected stream=true in request")
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher := w.(http.Flusher)
		for _, c := range chunks {
			chunk := chatCompletionChunk{Choices: []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			}{{Delta: struct {
				Content string `json:"content"`
			}{Content: c}}}}
			data, _ := json.Marshal(chunk)
			_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
		_, _ = fmt.Fprint(w, "data: [DONE]\n\n")
		flusher.Flush()
	}))
	defer srv.Close()

	p := NewGeminiProvider(config.AI{APIKey: "k", Model: "m", BaseURL: srv.URL})

	var revealed strings.Builder
	out, err := p.StreamHint(context.Background(), AssistantHintInput{Title: "Two Sum"}, func(delta string) {
		revealed.WriteString(delta)
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// parseAssistantHintContent trims the final hint (out.Hint), but the
	// streamed deltas reveal the raw, untrimmed decoded value as it arrives.
	if revealed.String() != "Посмотри на парей.\n" {
		t.Fatalf("unexpected revealed text: %q", revealed.String())
	}
	if out.Hint != "Посмотри на парей." {
		t.Fatalf("unexpected hint: %q", out.Hint)
	}
	if out.Question != "Что хранить?" || out.Stage != "approach" {
		t.Fatalf("unexpected out: %+v", out)
	}
}

func TestGeminiProvider_GenerateCards_UnknownProblem(t *testing.T) {
	srv := newTestServer(t, http.StatusOK, chatCompletionBody(`{"error":"unknown_problem"}`))
	p := NewGeminiProvider(config.AI{APIKey: "k", Model: "m", BaseURL: srv.URL})

	_, err := p.GenerateCards(context.Background(), GenerateCardsInput{Title: "Mystery Problem"})
	if err != ErrUnknownProblem {
		t.Fatalf("err = %v, want ErrUnknownProblem", err)
	}
}

func TestGeminiProvider_GenerateCards_QuotaExceeded(t *testing.T) {
	srv := newTestServer(t, http.StatusTooManyRequests, `{"error":"rate limited"}`)
	p := NewGeminiProvider(config.AI{APIKey: "k", Model: "m", BaseURL: srv.URL})

	_, err := p.GenerateCards(context.Background(), GenerateCardsInput{Title: "Two Sum"})
	if err != ErrQuotaExceeded {
		t.Fatalf("err = %v, want ErrQuotaExceeded", err)
	}
}

func TestGeminiProvider_GenerateCards_ServerError(t *testing.T) {
	srv := newTestServer(t, http.StatusInternalServerError, `oops`)
	p := NewGeminiProvider(config.AI{APIKey: "k", Model: "m", BaseURL: srv.URL})

	_, err := p.GenerateCards(context.Background(), GenerateCardsInput{Title: "Two Sum"})
	if err == nil {
		t.Fatal("expected an error for 500 response")
	}
}

func TestParseGenerationContent(t *testing.T) {
	t.Run("success array", func(t *testing.T) {
		cards, err := parseGenerationContent(`[{"type":"pattern_recognition","question":"q","answer":"a","explanation":"e"}]`)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(cards) != 1 || cards[0].Question != "q" {
			t.Fatalf("unexpected cards: %+v", cards)
		}
	})

	t.Run("unknown problem refusal", func(t *testing.T) {
		_, err := parseGenerationContent(`{"error":"unknown_problem"}`)
		if err != ErrUnknownProblem {
			t.Fatalf("err = %v, want ErrUnknownProblem", err)
		}
	})

	t.Run("empty array is an error", func(t *testing.T) {
		if _, err := parseGenerationContent(`[]`); err == nil {
			t.Fatal("expected error for empty array")
		}
	})

	t.Run("garbage is an error", func(t *testing.T) {
		if _, err := parseGenerationContent(`not json`); err == nil {
			t.Fatal("expected error for invalid json")
		}
	})
}

func TestParseAssistantHintContent(t *testing.T) {
	out, err := parseAssistantHintContent("```json\n{\"hint\":\"h\",\"question\":\"q\",\"stage\":\"unexpected\"}\n```")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Hint != "h" || out.Question != "q" || out.Stage != "nudge" {
		t.Fatalf("unexpected parsed hint: %+v", out)
	}
	if _, err := parseAssistantHintContent(`{"hint":"","stage":"nudge"}`); err == nil {
		t.Fatal("expected error for empty hint")
	}
}

func TestRenderPromptUser(t *testing.T) {
	out, err := renderPromptUser(promptUserTmplV1, GenerateCardsInput{
		Platform: "leetcode", Slug: "two-sum", Title: "Two Sum", Difficulty: "easy", URL: "https://leetcode.com/problems/two-sum/",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, want := range []string{"leetcode", "two-sum", "Two Sum", "easy", "https://leetcode.com/problems/two-sum/"} {
		if !strings.Contains(out, want) {
			t.Errorf("rendered prompt missing %q:\n%s", want, out)
		}
	}
}
