package roadmap

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
)

func TestGet_Unauthenticated(t *testing.T) {
	h := NewHandler(fakeRepository{})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me/roadmap", nil)
	w := httptest.NewRecorder()

	h.Get(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestGet_ResponseShape(t *testing.T) {
	company := "Google"
	h := NewHandler(fakeRepository{data: Response{
		OverallProgress: 50,
		Target:          Target{Company: &company},
		Weeks:           []Week{{ID: "week_01", Status: "active"}},
		Patterns:        []Pattern{{Code: "arrays_hashing", Problems: []Problem{{ID: 1, Status: "reviewing"}}}},
	}})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me/roadmap", nil)
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 10))
	w := httptest.NewRecorder()

	h.Get(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var body struct {
		Data Response `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if body.Data.OverallProgress != 50 || len(body.Data.Patterns) != 1 {
		t.Fatalf("unexpected data: %+v", body.Data)
	}
}

func TestGet_UserNotFound(t *testing.T) {
	h := NewHandler(fakeRepository{err: ErrUserNotFound})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me/roadmap", nil)
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 10))
	w := httptest.NewRecorder()

	h.Get(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

type fakeRepository struct {
	data Response
	err  error
}

func (f fakeRepository) Get(context.Context, int64) (Response, error) {
	if f.err != nil {
		return Response{}, f.err
	}
	if f.data.Weeks == nil {
		f.data.Weeks = []Week{}
	}
	if f.data.Patterns == nil {
		f.data.Patterns = []Pattern{}
	}
	return f.data, nil
}

func TestGet_InternalError(t *testing.T) {
	h := NewHandler(fakeRepository{err: errors.New("boom")})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me/roadmap", nil)
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 10))
	w := httptest.NewRecorder()

	h.Get(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusInternalServerError)
	}
}
