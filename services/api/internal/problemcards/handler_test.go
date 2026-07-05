package problemcards

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
)

type fakeService struct {
	resp Response
	err  error
}

func (f *fakeService) Get(context.Context, int64, int64) (Response, error) {
	return f.resp, f.err
}

func withUser(r *http.Request, userID int64) *http.Request {
	ctx := auth.ContextWithUserID(r.Context(), userID)
	return r.WithContext(ctx)
}

func newRouter(h *Handler) http.Handler {
	r := chi.NewRouter()
	r.Route("/me/problems", func(r chi.Router) {
		RegisterRoutes(r, h)
	})
	return r
}

func TestHandler_Get_Unauthorized(t *testing.T) {
	h := NewHandler(&fakeService{})
	req := httptest.NewRequest(http.MethodGet, "/me/problems/1/cards", nil)
	w := httptest.NewRecorder()
	newRouter(h).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
}

func TestHandler_Get_InvalidProblemID(t *testing.T) {
	h := NewHandler(&fakeService{})
	req := withUser(httptest.NewRequest(http.MethodGet, "/me/problems/not-a-number/cards", nil), 1)
	w := httptest.NewRecorder()
	newRouter(h).ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}

func TestHandler_Get_NotFound(t *testing.T) {
	h := NewHandler(&fakeService{err: ErrProblemNotFound})
	req := withUser(httptest.NewRequest(http.MethodGet, "/me/problems/999/cards", nil), 1)
	w := httptest.NewRecorder()
	newRouter(h).ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}
}

func TestHandler_Get_Success(t *testing.T) {
	h := NewHandler(&fakeService{resp: Response{Status: StatusGenerating, Cards: nil}})
	req := withUser(httptest.NewRequest(http.MethodGet, "/me/problems/42/cards", nil), 1)
	w := httptest.NewRecorder()
	newRouter(h).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body=%s", w.Code, w.Body.String())
	}
	var body struct {
		Data Response `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Data.Status != StatusGenerating {
		t.Fatalf("status = %q, want generating", body.Data.Status)
	}
}
