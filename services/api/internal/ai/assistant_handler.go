package ai

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/httpjson"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

const (
	maxAssistantMessageChars     = 1200
	maxAssistantHistoryItems     = 8
	maxAssistantTags             = 12
	maxAssistantHintLevel        = 5
	maxAssistantDescriptionChars = 6000
)

type assistantRepository interface {
	AssistantProblemContext(ctx context.Context, platform, slug string) (AssistantHintInput, error)
	LogAssistantHintRequest(ctx context.Context, userID int64, model, status string) error
}

type AssistantHandler struct {
	repo     assistantRepository
	provider HintProvider
}

func NewAssistantHandler(repo assistantRepository, provider HintProvider) *AssistantHandler {
	return &AssistantHandler{repo: repo, provider: provider}
}

func RegisterAssistantRoutes(r chi.Router, h *AssistantHandler) {
	r.Post("/hint", h.Hint)
}

// Hint handles POST /api/v1/assistant/hint.
func (h *AssistantHandler) Hint(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}
	if h.provider == nil {
		response.Fail(w, http.StatusServiceUnavailable, "AI_UNAVAILABLE", "AI assistant is not configured")
		return
	}

	var req AssistantHintRequest
	if !httpjson.DecodeStrict(w, r, &req, "VALIDATION_ERROR") {
		return
	}

	input, err := normalizeAssistantRequest(req)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	dbContext, err := h.repo.AssistantProblemContext(r.Context(), input.Platform, input.Slug)
	if err != nil {
		slog.Error("ai: assistant context failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load problem context")
		return
	}

	input = mergeAssistantContext(input, dbContext)
	input.PromptVersion = AssistantHintPromptVersionV1

	out, err := h.provider.GenerateHint(r.Context(), input)
	if err != nil {
		_ = h.repo.LogAssistantHintRequest(context.WithoutCancel(r.Context()), userID, h.provider.ModelName(), "failed")
		if errors.Is(err, ErrQuotaExceeded) {
			response.Fail(w, http.StatusTooManyRequests, "AI_QUOTA_EXCEEDED", "AI assistant quota is exhausted")
			return
		}
		logAssistantProviderError(err, userID)
		response.Fail(w, http.StatusBadGateway, "AI_PROVIDER_ERROR", "could not generate hint")
		return
	}

	if err := h.repo.LogAssistantHintRequest(context.WithoutCancel(r.Context()), userID, h.provider.ModelName(), "success"); err != nil {
		slog.Warn("ai: assistant log failed", slog.Any("err", err), slog.Int64("user_id", userID))
	}
	response.JSON(w, http.StatusOK, out)
}

// logAssistantProviderError logs the upstream failure with the HTTP status
// code and response body as separate, greppable fields (rather than buried
// inside one error string) — this is what distinguishes a Google-side geo
// block or quota/permission rejection from a transient network failure or a
// bug on our end, without needing shell access to the prod container.
func logAssistantProviderError(err error, userID int64) {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		slog.Error("ai: assistant hint failed: gemini api error",
			slog.Int("status_code", apiErr.StatusCode),
			slog.String("body", apiErr.Body),
			slog.Int64("user_id", userID),
		)
		return
	}
	slog.Error("ai: assistant hint failed", slog.Any("err", err), slog.Int64("user_id", userID))
}

func normalizeAssistantRequest(req AssistantHintRequest) (AssistantHintInput, error) {
	platform := strings.ToLower(strings.TrimSpace(req.Platform))
	if platform != "leetcode" && platform != "neetcode" {
		return AssistantHintInput{}, errors.New("platform must be leetcode or neetcode")
	}
	slug := strings.TrimSpace(req.PlatformTaskSlug)
	if slug == "" {
		return AssistantHintInput{}, errors.New("platformTaskSlug is required")
	}
	title := strings.TrimSpace(req.TaskTitle)
	if title == "" {
		return AssistantHintInput{}, errors.New("taskTitle is required")
	}
	url := strings.TrimSpace(req.TaskURL)
	if url == "" {
		return AssistantHintInput{}, errors.New("taskUrl is required")
	}
	message := strings.TrimSpace(req.Message)
	if message == "" {
		message = "Я застрял. Дай мягкую наводку, не раскрывая решение."
	}
	if len([]rune(message)) > maxAssistantMessageChars {
		return AssistantHintInput{}, errors.New("message is too long")
	}

	hintLevel := req.HintLevel
	if hintLevel < 1 {
		hintLevel = 1
	}
	if hintLevel > maxAssistantHintLevel {
		hintLevel = maxAssistantHintLevel
	}

	history, err := normalizeAssistantHistory(req.History)
	if err != nil {
		return AssistantHintInput{}, err
	}

	description := strings.TrimSpace(req.TaskDescription)
	if len([]rune(description)) > maxAssistantDescriptionChars {
		runes := []rune(description)
		description = string(runes[:maxAssistantDescriptionChars])
	}

	return AssistantHintInput{
		Platform:    platform,
		Slug:        slug,
		Title:       title,
		URL:         url,
		Difficulty:  normalizeOptional(req.Difficulty, "unknown"),
		Tags:        normalizeStringSlice(req.Tags, maxAssistantTags),
		Description: description,
		Message:     message,
		HintLevel:   hintLevel,
		History:     history,
	}, nil
}

func normalizeAssistantHistory(history []AssistantMessage) ([]AssistantMessage, error) {
	if len(history) > maxAssistantHistoryItems {
		history = history[len(history)-maxAssistantHistoryItems:]
	}
	out := make([]AssistantMessage, 0, len(history))
	for _, item := range history {
		role := item.Role
		if role != AssistantRoleUser && role != AssistantRoleAssistant {
			return nil, errors.New("history role must be user or assistant")
		}
		content := strings.TrimSpace(item.Content)
		if content == "" {
			continue
		}
		if len([]rune(content)) > maxAssistantMessageChars {
			return nil, errors.New("history item is too long")
		}
		out = append(out, AssistantMessage{Role: role, Content: content})
	}
	return out, nil
}

func mergeAssistantContext(input, dbContext AssistantHintInput) AssistantHintInput {
	if !dbContext.ProblemKnown {
		input.ProblemKnown = false
		return input
	}
	input.ProblemKnown = true
	input.ProblemID = dbContext.ProblemID
	input.Platform = dbContext.Platform
	input.Slug = dbContext.Slug
	input.Title = preferNonEmpty(dbContext.Title, input.Title)
	input.URL = preferNonEmpty(dbContext.URL, input.URL)
	input.Difficulty = preferNonEmpty(dbContext.Difficulty, input.Difficulty)
	input.Patterns = dbContext.Patterns
	return input
}

func normalizeOptional(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func normalizeStringSlice(values []string, limit int) []string {
	if len(values) > limit {
		values = values[:limit]
	}
	out := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		normalized := strings.TrimSpace(value)
		if normalized == "" {
			continue
		}
		key := strings.ToLower(normalized)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, normalized)
	}
	return out
}

func preferNonEmpty(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
