package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
)

type fakeCardGenerator struct {
	status string
	err    error
	called bool
	gotID  int64
}

func (f *fakeCardGenerator) Ensure(_ context.Context, problemID int64) (string, error) {
	f.called = true
	f.gotID = problemID
	return f.status, f.err
}

type fakeAIRepo struct{}

func (fakeAIRepo) CreateAIRequestLog(context.Context, int64, string) (int64, error) { return 1, nil }

func generateCardRequest(t *testing.T, body map[string]any) *http.Request {
	t.Helper()
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/me/cards/generate", bytes.NewReader(raw))
	return req.WithContext(auth.ContextWithUserID(req.Context(), 7))
}

func TestGenerateCard_Unauthenticated(t *testing.T) {
	h := NewHandler(fakeAIRepo{}, &fakeCardGenerator{status: EnsureReady})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/me/cards/generate", bytes.NewReader([]byte(`{}`)))
	rec := httptest.NewRecorder()

	h.GenerateCard(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestGenerateCard_RejectsPatternID(t *testing.T) {
	h := NewHandler(fakeAIRepo{}, &fakeCardGenerator{status: EnsureReady})
	patternID := int64(5)
	req := generateCardRequest(t, map[string]any{"pattern_id": patternID})
	rec := httptest.NewRecorder()

	h.GenerateCard(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestGenerateCard_RequiresProblemID(t *testing.T) {
	h := NewHandler(fakeAIRepo{}, &fakeCardGenerator{status: EnsureReady})
	req := generateCardRequest(t, map[string]any{})
	rec := httptest.NewRecorder()

	h.GenerateCard(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestGenerateCard_AIDisabled(t *testing.T) {
	h := NewHandler(fakeAIRepo{}, nil)
	problemID := int64(1)
	req := generateCardRequest(t, map[string]any{"problem_id": problemID})
	rec := httptest.NewRecorder()

	h.GenerateCard(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

func TestGenerateCard_Ready(t *testing.T) {
	gen := &fakeCardGenerator{status: EnsureReady}
	h := NewHandler(fakeAIRepo{}, gen)
	problemID := int64(42)
	req := generateCardRequest(t, map[string]any{"problem_id": problemID})
	rec := httptest.NewRecorder()

	h.GenerateCard(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !gen.called || gen.gotID != problemID {
		t.Fatalf("Ensure called with %v (called=%v), want problemID=%d", gen.gotID, gen.called, problemID)
	}
	var body struct {
		Data struct {
			Status string `json:"status"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Data.Status != EnsureReady {
		t.Fatalf("body.data.status = %q, want %q", body.Data.Status, EnsureReady)
	}
}

func TestGenerateCard_Generating(t *testing.T) {
	gen := &fakeCardGenerator{status: EnsureGenerating}
	h := NewHandler(fakeAIRepo{}, gen)
	problemID := int64(42)
	req := generateCardRequest(t, map[string]any{"problem_id": problemID})
	rec := httptest.NewRecorder()

	h.GenerateCard(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202", rec.Code)
	}
}

func TestGenerateCard_ProblemNotFound(t *testing.T) {
	gen := &fakeCardGenerator{err: ErrProblemNotFound}
	h := NewHandler(fakeAIRepo{}, gen)
	problemID := int64(999)
	req := generateCardRequest(t, map[string]any{"problem_id": problemID})
	rec := httptest.NewRecorder()

	h.GenerateCard(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestGenerateCard_EnsureErrorIsInternalError(t *testing.T) {
	gen := &fakeCardGenerator{err: errors.New("boom")}
	h := NewHandler(fakeAIRepo{}, gen)
	problemID := int64(1)
	req := generateCardRequest(t, map[string]any{"problem_id": problemID})
	rec := httptest.NewRecorder()

	h.GenerateCard(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
}
