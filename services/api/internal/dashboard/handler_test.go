package dashboard

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
)

func TestHandlerGet_RequiresAuthContext(t *testing.T) {
	h := NewHandler(fakeService{})
	req := httptest.NewRequest(http.MethodGet, "/me/dashboard", nil)
	w := httptest.NewRecorder()

	h.Get(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestHandlerGet_ResponseEnvelope(t *testing.T) {
	h := NewHandler(fakeService{resp: Response{Stats: []Stat{{Key: "today_queue"}}}})
	req := httptest.NewRequest(http.MethodGet, "/me/dashboard", nil)
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 42))
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
	if len(body.Data.Stats) != 1 || body.Data.Stats[0].Key != "today_queue" {
		t.Fatalf("unexpected response data: %#v", body.Data)
	}
}

type fakeService struct {
	resp Response
	err  error
}

func (f fakeService) Get(context.Context, int64) (Response, error) {
	return f.resp, f.err
}
