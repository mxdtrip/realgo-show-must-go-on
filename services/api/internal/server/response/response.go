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
	Error *Error `json:"error,omitempty"`
}

// Error is the machine-readable error body returned to clients.
type Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// JSON writes data under the "data" field with the given status code.
func JSON(w http.ResponseWriter, status int, data any) {
	write(w, status, envelope{Data: data})
}

// Fail writes a structured error under the "error" field with the given status.
func Fail(w http.ResponseWriter, status int, code, message string) {
	write(w, status, envelope{Error: &Error{Code: code, Message: message}})
}

func write(w http.ResponseWriter, status int, body envelope) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("failed to encode response", slog.Any("err", err))
	}
}
