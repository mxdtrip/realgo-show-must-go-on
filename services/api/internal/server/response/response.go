// Package response writes JSON HTTP responses in a single envelope shape:
// successful payloads go under "data", failures under "error".
package response

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type envelope struct {
	Data  any    `json:"data,omitempty"`
	Meta  any    `json:"meta,omitempty"`
	Error *Error `json:"error,omitempty"`
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
	write(w, status, envelope{Data: data})
}

// JSONWithMeta writes a successful response with both top-level data and meta.
func JSONWithMeta(w http.ResponseWriter, status int, data any, meta any) {
	write(w, status, envelope{Data: data, Meta: meta})
}

// Fail writes a structured error under the "error" field with the given status.
func Fail(w http.ResponseWriter, status int, code, message string) {
	write(w, status, envelope{Error: &Error{Code: code, Message: message}})
}

func FailWithDetails(w http.ResponseWriter, status int, code, message, field string) {
	write(w, status, envelope{Error: &Error{
		Code:    code,
		Message: message,
		Details: &ErrorDetails{Field: field},
	}})
}

func write(w http.ResponseWriter, status int, body envelope) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("failed to encode response", slog.Any("err", err))
	}
}
