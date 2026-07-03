package request

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

const maxJSONBodyBytes = 1 << 20

func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			response.Fail(w, http.StatusRequestEntityTooLarge, "REQUEST_TOO_LARGE", "request body is too large")
		} else {
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		}
		return false
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "request body must contain a single JSON object")
		return false
	}
	return true
}
