package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
)

type fakeAssistantRepo struct {
	ctxInput   AssistantHintInput
	logs       []string
	reserveErr error
}

func (f *fakeAssistantRepo) AssistantProblemContext(_ context.Context, platform, slug string) (AssistantHintInput, error) {
	f.ctxInput.Platform = platform
	f.ctxInput.Slug = slug
	if f.ctxInput.Title == "" {
		f.ctxInput.Title = "Two Sum"
	}
	if f.ctxInput.Difficulty == "" {
		f.ctxInput.Difficulty = "easy"
	}
	return f.ctxInput, nil
}

func (f *fakeAssistantRepo) ReserveAssistantHintRequest(_ context.Context, _ int64, _ *int64, _, _, _ string) (int64, error) {
	return 1, f.reserveErr
}

func (f *fakeAssistantRepo) FinishAssistantHintRequest(_ context.Context, _ int64, status string) error {
	f.logs = append(f.logs, status)
	return nil
}

type fakeHintProvider struct {
	input AssistantHintInput
	calls int
}

func (f *fakeHintProvider) GenerateHint(_ context.Context, in AssistantHintInput) (AssistantHintResponse, error) {
	f.calls++
	f.input = in
	return AssistantHintResponse{
		Hint:         "Сфокусируйся на том, что нужно найти для текущего элемента.",
		Question:     "Что можно сохранить из уже просмотренной части массива?",
		Stage:        "approach",
		ProblemKnown: in.ProblemKnown,
		Patterns:     in.Patterns,
	}, nil
}

func (f *fakeHintProvider) StreamHint(ctx context.Context, in AssistantHintInput, onDelta func(string)) (AssistantHintResponse, error) {
	out, err := f.GenerateHint(ctx, in)
	if err == nil && onDelta != nil {
		onDelta(out.Hint)
	}
	return out, err
}

func (f *fakeHintProvider) ModelName() string { return "fake-model" }

func (f *fakeHintProvider) ProviderName() string { return "fake" }

func TestAssistantHandler_ReservationFailureDoesNotCallProvider(t *testing.T) {
	repo := &fakeAssistantRepo{reserveErr: errors.New("database unavailable")}
	provider := &fakeHintProvider{}
	handler := NewAssistantHandler(repo, provider)
	raw, _ := json.Marshal(map[string]any{
		"platform": "leetcode", "taskTitle": "Two Sum", "taskUrl": "https://leetcode.com/problems/two-sum/",
		"platformTaskSlug": "two-sum", "message": "help", "hintLevel": 1,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/hint", bytes.NewReader(raw))
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 42))
	rec := httptest.NewRecorder()

	handler.Hint(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
	if provider.calls != 0 {
		t.Fatalf("provider calls = %d, want 0", provider.calls)
	}
}

func TestAssistantHandler_Hint(t *testing.T) {
	repo := &fakeAssistantRepo{ctxInput: AssistantHintInput{
		Platform:     "leetcode",
		Slug:         "two-sum",
		Title:        "Two Sum",
		URL:          "https://leetcode.com/problems/two-sum/",
		Difficulty:   "easy",
		ProblemKnown: true,
		ProblemID:    7,
		Patterns:     []AssistantPattern{{Code: "complement_lookup", Name: "Complement Lookup / Pair Mapping", Tier: "core"}},
	}}
	provider := &fakeHintProvider{}
	handler := NewAssistantHandler(repo, provider)

	reqBody := map[string]any{
		"platform":         "leetcode",
		"taskTitle":        "Two Sum",
		"taskUrl":          "https://leetcode.com/problems/two-sum/",
		"platformTaskSlug": "two-sum",
		"message":          "Я застрял",
		"hintLevel":        2,
		"history": []map[string]string{
			{"role": "user", "content": "Не понимаю, что хранить"},
		},
	}
	raw, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/hint", bytes.NewReader(raw))
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 42))
	rec := httptest.NewRecorder()

	handler.Hint(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if provider.input.HintLevel != 2 || provider.input.ProblemID != 7 || len(provider.input.Patterns) != 1 {
		t.Fatalf("provider input missing context: %+v", provider.input)
	}
	if len(repo.logs) != 1 || repo.logs[0] != "success" {
		t.Fatalf("logs = %+v", repo.logs)
	}

	var body struct {
		Data AssistantHintResponse `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Data.Stage != "approach" || !body.Data.ProblemKnown || len(body.Data.Patterns) != 1 {
		t.Fatalf("unexpected response: %+v", body.Data)
	}
}

func TestAssistantHandler_Hint_AcceptsAllCatalogPlatforms(t *testing.T) {
	for _, platform := range []string{"leetcode", "geeksforgeeks", "hackerrank", "codeforces"} {
		t.Run(platform, func(t *testing.T) {
			repo := &fakeAssistantRepo{}
			provider := &fakeHintProvider{}
			handler := NewAssistantHandler(repo, provider)
			raw, _ := json.Marshal(map[string]any{
				"platform": platform, "taskTitle": "Some Task", "taskUrl": "https://example.com/task",
				"platformTaskSlug": "some-task", "message": "help", "hintLevel": 1,
			})
			req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/hint", bytes.NewReader(raw))
			req = req.WithContext(auth.ContextWithUserID(req.Context(), 42))
			rec := httptest.NewRecorder()

			handler.Hint(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
			}
			if provider.input.Platform != platform {
				t.Fatalf("provider input platform = %q, want %q", provider.input.Platform, platform)
			}
		})
	}
}

func TestAssistantHandler_Hint_RejectsUnknownPlatform(t *testing.T) {
	repo := &fakeAssistantRepo{}
	provider := &fakeHintProvider{}
	handler := NewAssistantHandler(repo, provider)
	raw, _ := json.Marshal(map[string]any{
		"platform": "neetcode", "taskTitle": "Some Task", "taskUrl": "https://example.com/task",
		"platformTaskSlug": "some-task", "message": "help", "hintLevel": 1,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/hint", bytes.NewReader(raw))
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 42))
	rec := httptest.NewRecorder()

	handler.Hint(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400, body = %s", rec.Code, rec.Body.String())
	}
	if provider.calls != 0 {
		t.Fatalf("provider calls = %d, want 0", provider.calls)
	}
}

func TestAssistantHandler_Hint_Stream(t *testing.T) {
	repo := &fakeAssistantRepo{ctxInput: AssistantHintInput{
		Platform: "leetcode", Slug: "two-sum", ProblemKnown: true,
	}}
	provider := &fakeHintProvider{}
	handler := NewAssistantHandler(repo, provider)

	reqBody := map[string]any{
		"platform":         "leetcode",
		"taskTitle":        "Two Sum",
		"taskUrl":          "https://leetcode.com/problems/two-sum/",
		"platformTaskSlug": "two-sum",
		"message":          "Я застрял",
		"hintLevel":        1,
	}
	raw, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/hint?stream=1", bytes.NewReader(raw))
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 42))
	rec := httptest.NewRecorder()

	handler.Hint(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("content-type = %q", ct)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "event: delta") {
		t.Fatalf("expected at least one delta event, got: %s", body)
	}
	if !strings.Contains(body, "event: done") {
		t.Fatalf("expected a done event, got: %s", body)
	}
	if len(repo.logs) != 1 || repo.logs[0] != "success" {
		t.Fatalf("logs = %+v", repo.logs)
	}
}

func TestAssistantHandler_HintProviderUnavailable(t *testing.T) {
	handler := NewAssistantHandler(&fakeAssistantRepo{}, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/hint", bytes.NewReader([]byte(`{}`)))
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 42))
	rec := httptest.NewRecorder()

	handler.Hint(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}
