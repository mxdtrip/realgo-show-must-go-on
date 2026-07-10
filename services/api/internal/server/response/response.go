// Package response writes JSON HTTP responses in a single envelope shape:
// successful payloads go under "data", failures under "error".
package response

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// requestIDHeader is the response header the request-logging middleware sets
// with the chi request id. The response layer reads it back here (it only
// receives http.ResponseWriter, not the request context) to mirror the id into
// meta.requestId. Using a header as the bridge keeps every response helper
// signature unchanged.
const requestIDHeader = "X-Request-Id"

type envelope struct {
	Data  any    `json:"data,omitempty"`
	Meta  *Meta  `json:"meta,omitempty"`
	Error *Error `json:"error,omitempty"`
}

// Meta carries per-response metadata. RequestID is populated automatically from
// the X-Request-Id header (set by the request-logging middleware); NextCursor is
// supplied by paginated handlers via JSONWithMeta.
type Meta struct {
	RequestID  string  `json:"requestId,omitempty"`
	NextCursor *string `json:"nextCursor,omitempty"`
}

// Error is the machine-readable error body returned to clients.
type Error struct {
	Code    string        `json:"code"`
	Message string        `json:"message"`
	Details *ErrorDetails `json:"details,omitempty"`
}

type ErrorDetails struct {
	Field string `json:"field,omitempty"`
}

// JSON writes data under the "data" field with the given status code.
func JSON(w http.ResponseWriter, status int, data any) {
	write(w, status, envelope{Data: data, Meta: metaFromHeader(w)})
}

// JSONWithMeta writes a successful response with both top-level data and meta.
// The supplied meta's pagination field is merged with the request id read from
// the X-Request-Id header, so every paginated response also carries
// meta.requestId.
func JSONWithMeta(w http.ResponseWriter, status int, data any, meta Meta) {
	if reqID := w.Header().Get(requestIDHeader); reqID != "" {
		meta.RequestID = reqID
	}
	var metaPtr *Meta
	// Only attach meta when there is something to send, so the key is omitted
	// entirely from the JSON when neither requestId nor nextCursor is set.
	if meta.RequestID != "" || meta.NextCursor != nil {
		metaPtr = &meta
	}
	write(w, status, envelope{Data: data, Meta: metaPtr})
}

// Fail writes a structured error under the "error" field with the given status.
func Fail(w http.ResponseWriter, status int, code, message string) {
	write(w, status, envelope{Error: &Error{Code: code, Message: message}, Meta: metaFromHeader(w)})
}

func FailWithDetails(w http.ResponseWriter, status int, code, message, field string) {
	write(w, status, envelope{
		Error: &Error{
			Code:    code,
			Message: message,
			Details: &ErrorDetails{Field: field},
		},
		Meta: metaFromHeader(w),
	})
}

// metaFromHeader builds a *Meta carrying only the request id from the
// X-Request-Id response header. It returns nil when no id is present so the
// "meta" key is omitted from the JSON via envelope's omitempty tag.
func metaFromHeader(w http.ResponseWriter) *Meta {
	reqID := w.Header().Get(requestIDHeader)
	if reqID == "" {
		return nil
	}
	return &Meta{RequestID: reqID}
}

func write(w http.ResponseWriter, status int, body envelope) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("failed to encode response", slog.Any("err", err))
	}
}
