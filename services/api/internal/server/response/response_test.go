package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestJSONIncludesRequestIDFromHeader(t *testing.T) {
	w := httptest.NewRecorder()
	w.Header().Set(requestIDHeader, "req-123")

	JSON(w, http.StatusOK, map[string]string{"hello": "world"})

	var body struct {
		Data map[string]string `json:"data"`
		Meta *Meta             `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v\nbody: %s", err, w.Body.String())
	}
	if body.Meta == nil {
		t.Fatalf("expected meta to be present, got nil; body: %s", w.Body.String())
	}
	if body.Meta.RequestID != "req-123" {
		t.Fatalf("meta.requestId = %q, want %q; body: %s", body.Meta.RequestID, "req-123", w.Body.String())
	}
}

func TestFailIncludesRequestIDFromHeader(t *testing.T) {
	w := httptest.NewRecorder()
	w.Header().Set(requestIDHeader, "err-456")

	Fail(w, http.StatusBadRequest, "validation_error", "bad input")

	var body struct {
		Error *Error `json:"error"`
		Meta  *Meta  `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v\nbody: %s", err, w.Body.String())
	}
	if body.Meta == nil || body.Meta.RequestID != "err-456" {
		t.Fatalf("expected meta.requestId=%q, got %+v; body: %s", "err-456", body.Meta, w.Body.String())
	}
	if body.Error == nil || body.Error.Code != "validation_error" {
		t.Fatalf("expected error.code=validation_error, got %+v", body.Error)
	}
}

func TestFailWithDetailsIncludesRequestIDFromHeader(t *testing.T) {
	w := httptest.NewRecorder()
	w.Header().Set(requestIDHeader, "det-789")

	FailWithDetails(w, http.StatusBadRequest, "validation_error", "email required", "email")

	var body struct {
		Error *Error `json:"error"`
		Meta  *Meta  `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v\nbody: %s", err, w.Body.String())
	}
	if body.Meta == nil || body.Meta.RequestID != "det-789" {
		t.Fatalf("expected meta.requestId=%q, got %+v", "det-789", body.Meta)
	}
}

func TestJSONWithMetaMergesRequestIDAndCursor(t *testing.T) {
	w := httptest.NewRecorder()
	w.Header().Set(requestIDHeader, "merge-abc")

	cursor := "next-page-token"
	JSONWithMeta(w, http.StatusOK, []string{"a", "b"}, Meta{NextCursor: &cursor})

	var body struct {
		Data []string `json:"data"`
		Meta *Meta    `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v\nbody: %s", err, w.Body.String())
	}
	if body.Meta == nil {
		t.Fatalf("expected meta present; body: %s", w.Body.String())
	}
	if body.Meta.RequestID != "merge-abc" {
		t.Fatalf("meta.requestId = %q, want %q", body.Meta.RequestID, "merge-abc")
	}
	if body.Meta.NextCursor == nil || *body.Meta.NextCursor != cursor {
		t.Fatalf("meta.nextCursor = %v, want %q", body.Meta.NextCursor, cursor)
	}
}

func TestJSONOmitsMetaWhenNoRequestID(t *testing.T) {
	w := httptest.NewRecorder()
	// No X-Request-Id header set — simulates a handler invoked outside the
	// middleware stack (e.g. in unit tests).

	JSON(w, http.StatusOK, map[string]string{"ok": "true"})

	// The "meta" key must be absent entirely from the JSON body.
	if strings.Contains(w.Body.String(), `"meta"`) {
		t.Fatalf("expected meta key to be omitted, but it's present: %s", w.Body.String())
	}
}

func TestJSONWithMetaOmitsMetaWhenBothEmpty(t *testing.T) {
	w := httptest.NewRecorder()
	// No request id header and no cursor — meta should be omitted entirely.

	JSONWithMeta(w, http.StatusOK, []string{"x"}, Meta{})

	if strings.Contains(w.Body.String(), `"meta"`) {
		t.Fatalf("expected meta key to be omitted when both requestId and nextCursor are empty, got: %s", w.Body.String())
	}
}

func TestWriteSetsContentType(t *testing.T) {
	w := httptest.NewRecorder()
	JSON(w, http.StatusOK, map[string]string{"a": "b"})

	ct := w.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}
}
