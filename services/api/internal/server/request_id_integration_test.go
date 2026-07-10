package server

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

// TestRequestIDInBodyHeaderAndLog verifies the three surfaces of the request id
// all agree, satisfying issue #150's acceptance criteria:
//  1. The response body's meta.requestId
//  2. The X-Request-Id response header
//  3. The request_id field in the structured access log
//
// The test builds a minimal chi router with the same middleware stack used by
// server.New (minus Recoverer/Timeout which need no DB) plus a trivial handler
// that calls response.JSON, so it exercises the real requestLogger → header →
// metaFromHeader bridge without a database or Redis.
func TestRequestIDInBodyHeaderAndLog(t *testing.T) {
	var logBuf bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logBuf, nil))

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(requestLogger(logger))
	r.Get("/echo", func(w http.ResponseWriter, r *http.Request) {
		response.JSON(w, http.StatusOK, map[string]string{"ok": "true"})
	})

	req := httptest.NewRequest(http.MethodGet, "/echo", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
	}

	// 1. Body meta.requestId
	var body struct {
		Meta *response.Meta `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v\nbody: %s", err, w.Body.String())
	}
	if body.Meta == nil {
		t.Fatalf("expected meta present in body, got nil; body: %s", w.Body.String())
	}
	bodyReqID := body.Meta.RequestID
	if bodyReqID == "" {
		t.Fatalf("meta.requestId is empty; body: %s", w.Body.String())
	}

	// 2. X-Request-Id response header
	headerReqID := w.Header().Get("X-Request-Id")
	if headerReqID == "" {
		t.Fatal("X-Request-Id response header is missing")
	}
	if headerReqID != bodyReqID {
		t.Fatalf("header request id %q != body meta.requestId %q", headerReqID, bodyReqID)
	}

	// 3. request_id in the structured log line
	logOutput := logBuf.String()
	if !strings.Contains(logOutput, "request_id="+bodyReqID) {
		t.Fatalf("request_id=%q not found in log output:\n%s", bodyReqID, logOutput)
	}
}

// TestRequestIDHonoursInboundHeader verifies that when a client supplies an
// X-Request-Id, chi's RequestID middleware reuses it and the same value
// surfaces in the body and the header.
func TestRequestIDHonoursInboundHeader(t *testing.T) {
	var logBuf bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logBuf, nil))

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(requestLogger(logger))
	r.Get("/echo", func(w http.ResponseWriter, r *http.Request) {
		response.Fail(w, http.StatusBadRequest, "validation_error", "boom")
	})

	req := httptest.NewRequest(http.MethodGet, "/echo", nil)
	req.Header.Set("X-Request-Id", "client-supplied-42")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// The inbound id should be echoed back in both the header and the body.
	if got := w.Header().Get("X-Request-Id"); got != "client-supplied-42" {
		t.Fatalf("X-Request-Id header = %q, want %q", got, "client-supplied-42")
	}

	var body struct {
		Meta *response.Meta `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v\nbody: %s", err, w.Body.String())
	}
	if body.Meta == nil || body.Meta.RequestID != "client-supplied-42" {
		t.Fatalf("meta.requestId = %+v, want %q; body: %s", body.Meta, "client-supplied-42", w.Body.String())
	}
}
