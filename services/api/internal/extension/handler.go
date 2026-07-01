package extension

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

const maxEventBodyBytes = 1 << 20

// eventService is the behaviour the handler needs; satisfied by *Service.
type eventService interface {
	Handle(ctx context.Context, userID int64, req EventRequest) (EventResult, error)
}

// Handler serves the browser-extension ingest endpoint.
type Handler struct {
	svc eventService
}

// NewHandler builds the extension HTTP handler.
func NewHandler(svc eventService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts the extension routes on r (expected base: /extension).
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Post("/events", h.PostEvent)
}

// PostEvent: POST /api/v1/extension/events
func (h *Handler) PostEvent(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	var req EventRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxEventBodyBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}

	result, err := h.svc.Handle(r.Context(), userID, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrValidation):
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		case errors.Is(err, ErrUnknownPlatform):
			response.Fail(w, http.StatusUnprocessableEntity, "UNKNOWN_PLATFORM", err.Error())
		default:
			response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not save extension event")
		}
		return
	}

	response.JSON(w, http.StatusOK, result)
}
