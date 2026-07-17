package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

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
	out, err := p.StreamHint(context.Background(), AssistantHintInput{Title: "Two Sum", HintLevel: 2}, func(delta string) {
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

func TestGeminiProvider_RejectsOversizedResponseBody(t *testing.T) {
	srv := newTestServer(t, http.StatusOK, strings.Repeat("x", maxProviderResponseBytes+1))
	p := NewGeminiProvider(config.AI{APIKey: "k", Model: "m", BaseURL: srv.URL})

	_, err := p.doChat(context.Background(), nil)
	if !errors.Is(err, errProviderResponseTooLarge) {
		t.Fatalf("err = %v, want errProviderResponseTooLarge", err)
	}
}

func TestGeminiProvider_CapsProviderErrorBody(t *testing.T) {
	srv := newTestServer(t, http.StatusBadRequest, strings.Repeat("x", maxProviderErrorBodyBytes+100))
	p := NewGeminiProvider(config.AI{APIKey: "k", Model: "m", BaseURL: srv.URL})

	_, err := p.doChat(context.Background(), nil)
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("err = %v, want *APIError", err)
	}
	if len(apiErr.Body) > maxProviderErrorBodyBytes+len("...(truncated)") || !strings.HasSuffix(apiErr.Body, "...(truncated)") {
		t.Fatalf("provider error body was not capped: len=%d suffix=%q", len(apiErr.Body), apiErr.Body[len(apiErr.Body)-20:])
	}
}

func TestGeminiProvider_RejectsOversizedStream(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher := w.(http.Flusher)
		chunkText := strings.Repeat("x", 32*1024)
		for written := 0; written <= maxProviderResponseBytes; written += len(chunkText) {
			chunk := chatCompletionChunk{Choices: []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			}{{Delta: struct {
				Content string `json:"content"`
			}{Content: chunkText}}}}
			data, _ := json.Marshal(chunk)
			_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}))
	defer srv.Close()

	p := NewGeminiProvider(config.AI{APIKey: "k", Model: "m", BaseURL: srv.URL})
	_, err := p.chatStream(context.Background(), nil, nil)
	if !errors.Is(err, errProviderResponseTooLarge) {
		t.Fatalf("err = %v, want errProviderResponseTooLarge", err)
	}
}

func TestHintFieldExtractorCapsSearchBuffer(t *testing.T) {
	extractor := newHintFieldExtractor()
	if got := extractor.feed(strings.Repeat("x", maxHintKeySearchBytes*2)); got != "" {
		t.Fatalf("unexpected extracted text: %q", got)
	}
	if extractor.pending.Len() > hintKeySearchOverlap {
		t.Fatalf("pending search buffer grew to %d bytes", extractor.pending.Len())
	}
	if got := extractor.feed(`,"hint":"bounded"`); got != "bounded" {
		t.Fatalf("extracted = %q, want bounded", got)
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
	p.retryDelay = time.Millisecond

	_, err := p.GenerateCards(context.Background(), GenerateCardsInput{Title: "Two Sum"})
	if err != ErrQuotaExceeded {
		t.Fatalf("err = %v, want ErrQuotaExceeded", err)
	}
}

func TestGeminiProvider_GenerateCards_ServerError(t *testing.T) {
	srv := newTestServer(t, http.StatusInternalServerError, `oops`)
	p := NewGeminiProvider(config.AI{APIKey: "k", Model: "m", BaseURL: srv.URL})
	p.retryDelay = time.Millisecond

	_, err := p.GenerateCards(context.Background(), GenerateCardsInput{Title: "Two Sum"})
	if err == nil {
		t.Fatal("expected an error for 500 response")
	}
}

func validCardsJSON() string {
	return `[
		{"type":"pattern_recognition","question":"q1","answer":"a1","explanation":"e1"},
		{"type":"algorithm_mechanics","question":"q2","answer":"a2","explanation":"e2"},
		{"type":"edge_case","question":"q3","answer":"a3","explanation":""}
	]`
}

func TestParseGenerationContent(t *testing.T) {
	t.Run("success array", func(t *testing.T) {
		cards, err := parseGenerationContent(validCardsJSON())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(cards) != 3 {
			t.Fatalf("got %d cards, want 3", len(cards))
		}
		if cards[0].Type != "pattern_recognition" || cards[0].Question != "q1" {
			t.Fatalf("unexpected first card: %+v", cards[0])
		}
		if cards[2].Explanation != "" {
			t.Fatalf("expected empty explanation to be allowed, got %q", cards[2].Explanation)
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

	t.Run("too few cards is an error", func(t *testing.T) {
		_, err := parseGenerationContent(`[{"type":"pattern_recognition","question":"q","answer":"a"}]`)
		if err == nil {
			t.Fatal("expected error for a 1-card batch")
		}
	})

	t.Run("extra unrecognized type is an error", func(t *testing.T) {
		_, err := parseGenerationContent(`[
			{"type":"pattern_recognition","question":"q1","answer":"a1"},
			{"type":"algorithm_mechanics","question":"q2","answer":"a2"},
			{"type":"bonus_trivia","question":"q3","answer":"a3"}
		]`)
		if err == nil {
			t.Fatal("expected error for an unrecognized card type")
		}
	})

	t.Run("missing a required type (duplicated instead) is an error", func(t *testing.T) {
		_, err := parseGenerationContent(`[
			{"type":"pattern_recognition","question":"q1","answer":"a1"},
			{"type":"pattern_recognition","question":"q2","answer":"a2"},
			{"type":"edge_case","question":"q3","answer":"a3"}
		]`)
		if err == nil {
			t.Fatal("expected error when a required type is missing")
		}
	})

	t.Run("empty question is an error", func(t *testing.T) {
		_, err := parseGenerationContent(`[
			{"type":"pattern_recognition","question":"   ","answer":"a1"},
			{"type":"algorithm_mechanics","question":"q2","answer":"a2"},
			{"type":"edge_case","question":"q3","answer":"a3"}
		]`)
		if err == nil {
			t.Fatal("expected error for a blank question")
		}
	})

	t.Run("empty answer is an error", func(t *testing.T) {
		_, err := parseGenerationContent(`[
			{"type":"pattern_recognition","question":"q1","answer":""},
			{"type":"algorithm_mechanics","question":"q2","answer":"a2"},
			{"type":"edge_case","question":"q3","answer":"a3"}
		]`)
		if err == nil {
			t.Fatal("expected error for an empty answer")
		}
	})

	t.Run("oversized answer is an error", func(t *testing.T) {
		huge := strings.Repeat("а", maxCardAnswerRunes+1)
		content := `[
			{"type":"pattern_recognition","question":"q1","answer":"` + huge + `"},
			{"type":"algorithm_mechanics","question":"q2","answer":"a2"},
			{"type":"edge_case","question":"q3","answer":"a3"}
		]`
		if _, err := parseGenerationContent(content); err == nil {
			t.Fatal("expected error for an answer exceeding the length limit")
		}
	})
}

// TestGeminiProvider_GenerateCards_RetriesInvalidContentWithFeedback covers
// the "1 retry with feedback" contract: a first reply that fails validation
// gets one more attempt, seeded with the bad reply plus a feedback message,
// before GenerateCards gives up.
func TestGeminiProvider_GenerateCards_RetriesInvalidContentWithFeedback(t *testing.T) {
	var calls int
	var secondReqMessages []chatMessage
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var req chatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if calls == 1 {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(chatCompletionBody(`[{"type":"pattern_recognition","question":"q1","answer":"a1"}]`)))
			return
		}
		secondReqMessages = req.Messages
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(chatCompletionBody(validCardsJSON())))
	}))
	defer srv.Close()

	p := NewGeminiProvider(config.AI{APIKey: "k", Model: "m", BaseURL: srv.URL})
	cards, err := p.GenerateCards(context.Background(), GenerateCardsInput{Title: "Two Sum"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cards) != 3 {
		t.Fatalf("got %d cards, want 3", len(cards))
	}
	if calls != 2 {
		t.Fatalf("calls = %d, want exactly 2 (1 + 1 retry)", calls)
	}
	if len(secondReqMessages) != 4 {
		t.Fatalf("retry request messages = %+v, want 4 (system, user, assistant, feedback)", secondReqMessages)
	}
	if secondReqMessages[2].Role != "assistant" {
		t.Fatalf("expected the bad reply echoed back as an assistant turn, got %+v", secondReqMessages[2])
	}
	if secondReqMessages[3].Role != "user" || !strings.Contains(secondReqMessages[3].Content, "не прошёл проверку") {
		t.Fatalf("expected a feedback user turn, got %+v", secondReqMessages[3])
	}
}

// TestGeminiProvider_GenerateCards_InvalidContentExhaustsRetry checks that
// after the single retry also fails validation, GenerateCards gives up
// (garbage never reaches the caller) instead of retrying indefinitely.
func TestGeminiProvider_GenerateCards_InvalidContentExhaustsRetry(t *testing.T) {
	var calls int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(chatCompletionBody(`[{"type":"pattern_recognition","question":"q1","answer":"a1"}]`)))
	}))
	defer srv.Close()

	p := NewGeminiProvider(config.AI{APIKey: "k", Model: "m", BaseURL: srv.URL})
	cards, err := p.GenerateCards(context.Background(), GenerateCardsInput{Title: "Two Sum"})
	if err == nil {
		t.Fatal("expected an error after the retry also fails validation")
	}
	if cards != nil {
		t.Fatalf("expected no cards on failure, got %+v", cards)
	}
	if calls != 2 {
		t.Fatalf("calls = %d, want exactly 2 (1 + 1 retry, no more)", calls)
	}
}

// TestGeminiProvider_GenerateCards_RetriesTransientFailures covers the
// 429/5xx retry-with-backoff contract: transient failures are retried before
// giving up, and a subsequent success within the attempt budget is returned.
func TestGeminiProvider_GenerateCards_RetriesTransientFailures(t *testing.T) {
	for _, tc := range []struct {
		name       string
		failStatus int
	}{
		{name: "500 then success", failStatus: http.StatusInternalServerError},
		{name: "429 then success", failStatus: http.StatusTooManyRequests},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls int
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				if calls < chatMaxAttempts {
					w.WriteHeader(tc.failStatus)
					_, _ = w.Write([]byte(`{"error":"transient"}`))
					return
				}
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(chatCompletionBody(validCardsJSON())))
			}))
			defer srv.Close()

			p := NewGeminiProvider(config.AI{APIKey: "k", Model: "m", BaseURL: srv.URL})
			p.retryDelay = time.Millisecond

			cards, err := p.GenerateCards(context.Background(), GenerateCardsInput{Title: "Two Sum"})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(cards) != 3 {
				t.Fatalf("got %d cards, want 3", len(cards))
			}
			if calls != chatMaxAttempts {
				t.Fatalf("calls = %d, want exactly %d", calls, chatMaxAttempts)
			}
		})
	}
}

// TestGeminiProvider_GenerateCards_ExhaustsTransientRetries checks that a
// persistently failing upstream still gives up after chatMaxAttempts, rather
// than retrying forever, and surfaces the classified error.
func TestGeminiProvider_GenerateCards_ExhaustsTransientRetries(t *testing.T) {
	var calls int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`oops`))
	}))
	defer srv.Close()

	p := NewGeminiProvider(config.AI{APIKey: "k", Model: "m", BaseURL: srv.URL})
	p.retryDelay = time.Millisecond

	_, err := p.GenerateCards(context.Background(), GenerateCardsInput{Title: "Two Sum"})
	if err == nil {
		t.Fatal("expected an error once retries are exhausted")
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("err = %v, want *APIError", err)
	}
	if calls != chatMaxAttempts {
		t.Fatalf("calls = %d, want exactly %d", calls, chatMaxAttempts)
	}
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

// TestApplyHintLevel guards the deterministic level -> stage mapping added
// after live testing showed the model sometimes mislabels its own stage (or
// tacks a trailing question onto a level-3 reply despite the prompt
// forbidding it): the client must always see a stage consistent with the
// requested level, and level 3 must never carry a question.
func TestApplyHintLevel(t *testing.T) {
	cases := []struct {
		level        int
		wantStage    string
		questionKept bool
	}{
		{level: 1, wantStage: "nudge", questionKept: true},
		{level: 2, wantStage: "approach", questionKept: true},
		{level: 3, wantStage: "reveal", questionKept: false},
	}
	for _, tc := range cases {
		out := AssistantHintResponse{Stage: "approach", Question: "leftover question?"}
		applyHintLevel(&out, tc.level)
		if out.Stage != tc.wantStage {
			t.Errorf("level %d: stage = %q, want %q", tc.level, out.Stage, tc.wantStage)
		}
		wantQuestion := ""
		if tc.questionKept {
			wantQuestion = "leftover question?"
		}
		if out.Question != wantQuestion {
			t.Errorf("level %d: question = %q, want %q", tc.level, out.Question, wantQuestion)
		}
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
