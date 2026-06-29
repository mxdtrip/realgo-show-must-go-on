package server

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestHandler() http.Handler {
	return New(Deps{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
}

func TestHealthzReturnsOK(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status: want %d, got %d", http.StatusOK, rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
		t.Fatalf("content-type: unexpected %q", ct)
	}
	if body := rec.Body.String(); body == "" {
		t.Fatal("body: want non-empty JSON envelope, got empty")
	}
}

func TestUnknownRouteReturns404(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/nope", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status: want %d, got %d", http.StatusNotFound, rec.Code)
	}
}

func TestReadyzWithoutDependenciesReturnsUnavailable(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status: want %d, got %d", http.StatusServiceUnavailable, rec.Code)
	}
}

func TestAuthRouteWithoutServiceReturnsUnavailable(t *testing.T) {
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"email":"user@example.com","password":"password123"}`)
	newTestHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", body))

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status: want %d, got %d", http.StatusServiceUnavailable, rec.Code)
	}
}

func TestDecodeJSONRejectsTrailingObject(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"refresh_token":"one"}{"refresh_token":"two"}`))
	var dst refreshRequest

	if decodeJSON(rec, req, &dst) {
		t.Fatal("decodeJSON accepted multiple JSON objects")
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: want %d, got %d", http.StatusBadRequest, rec.Code)
	}
}
