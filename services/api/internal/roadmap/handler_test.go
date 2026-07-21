package roadmap

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
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
	code := "cmp_google"
	h := NewHandler(fakeRepository{data: Response{
		OverallProgress: 50,
		Target:          Target{Company: &Company{Code: &code, Name: "Google"}},
		Weeks:           []Week{{ID: "week_01", Status: "active"}},
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
	if body.Data.OverallProgress != 50 || len(body.Data.Weeks) != 1 {
		t.Fatalf("unexpected data: %+v", body.Data)
	}
	if body.Data.Target.Company == nil || body.Data.Target.Company.Name != "Google" {
		t.Fatalf("unexpected target.company: %+v", body.Data.Target.Company)
	}
}

func TestGet_ResponseShape_EmptyCompanySerialisesAsNull(t *testing.T) {
	h := NewHandler(fakeRepository{data: Response{
		Target: Target{Company: nil},
	}})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me/roadmap", nil)
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 10))
	w := httptest.NewRecorder()

	h.Get(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var raw struct {
		Data struct {
			Target struct {
				Company any `json:"company"`
			} `json:"target"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &raw); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if raw.Data.Target.Company != nil {
		t.Fatalf("target.company = %v, want null when no company stored", raw.Data.Target.Company)
	}
}

func TestGet_ResponseShape_TopicsSerialiseAsArray(t *testing.T) {
	h := NewHandler(fakeRepository{data: Response{
		Target: Target{Topics: []string{"arrays", "two_pointers"}},
	}})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/me/roadmap", nil)
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 10))
	w := httptest.NewRecorder()

	h.Get(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var raw struct {
		Data struct {
			Target struct {
				Topics []string `json:"topics"`
			} `json:"target"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &raw); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if len(raw.Data.Target.Topics) != 2 || raw.Data.Target.Topics[0] != "arrays" {
		t.Fatalf("target.topics = %v, want [arrays two_pointers]", raw.Data.Target.Topics)
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
	data     Response
	err      error
	clearErr error
}

func (f fakeRepository) Get(context.Context, int64) (Response, error) {
	if f.err != nil {
		return Response{}, f.err
	}
	if f.data.Weeks == nil {
		f.data.Weeks = []Week{}
	}
	return f.data, nil
}

func (f fakeRepository) Clear(context.Context, int64) error {
	return f.clearErr
}

func (f fakeRepository) Preview(context.Context, int64, ConfigRequest) (Response, error) {
	if f.err != nil {
		return Response{}, f.err
	}
	return f.data, nil
}

func (f fakeRepository) Save(context.Context, int64, ConfigRequest) (Response, error) {
	if f.err != nil {
		return Response{}, f.err
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

func TestDelete_Unauthenticated(t *testing.T) {
	h := NewHandler(fakeRepository{})
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/me/roadmap", nil)
	w := httptest.NewRecorder()

	h.Delete(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestDelete_Success(t *testing.T) {
	h := NewHandler(fakeRepository{})
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/me/roadmap", nil)
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 10))
	w := httptest.NewRecorder()

	h.Delete(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusNoContent)
	}
	if w.Body.Len() != 0 {
		t.Fatalf("body = %q, want empty", w.Body.String())
	}
}

func TestDelete_InternalError(t *testing.T) {
	h := NewHandler(fakeRepository{clearErr: errors.New("boom")})
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/me/roadmap", nil)
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 10))
	w := httptest.NewRecorder()

	h.Delete(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusInternalServerError)
	}
}

func TestPreview_RejectsUnknownMode(t *testing.T) {
	h := NewHandler(fakeRepository{})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/me/roadmap/preview", strings.NewReader(`{"priorityMode":"random"}`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 10))
	w := httptest.NewRecorder()

	h.Preview(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestPut_Success(t *testing.T) {
	h := NewHandler(fakeRepository{data: Response{PriorityMode: PriorityEasyFirst, Weeks: []Week{}}})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/me/roadmap", strings.NewReader(`{"companyCode":"cmp_google","companyName":"Google","interviewDate":"2026-08-12","priorityMode":"easy_first"}`))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(auth.ContextWithUserID(req.Context(), 10))
	w := httptest.NewRecorder()

	h.Put(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", w.Code, http.StatusOK, w.Body.String())
	}
}
