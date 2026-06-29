package server

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

// authHandler exposes the authentication endpoints over the auth service.
type authHandler struct {
	svc *auth.Service
}

const maxJSONBodyBytes = 1 << 20

type credentialsRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type userResponse struct {
	ID            int64   `json:"id"`
	Email         string  `json:"email"`
	Timezone      string  `json:"timezone"`
	Plan          string  `json:"plan"`
	InterviewDate *string `json:"interview_date"`
	CreatedAt     string  `json:"created_at"`
}

type authResponse struct {
	User   userResponse   `json:"user"`
	Tokens auth.TokenPair `json:"tokens"`
}

func newUserResponse(u db.User) userResponse {
	resp := userResponse{
		ID:       u.ID,
		Email:    u.Email,
		Timezone: u.Timezone.String,
		Plan:     u.Plan.String,
	}
	if u.CreatedAt.Valid {
		resp.CreatedAt = u.CreatedAt.Time.UTC().Format(time.RFC3339)
	}
	if u.InterviewDate.Valid {
		d := u.InterviewDate.Time.UTC().Format(time.RFC3339)
		resp.InterviewDate = &d
	}
	return resp
}

func (h *authHandler) register(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	req, ok := decodeCredentials(w, r)
	if !ok {
		return
	}
	user, tokens, err := h.svc.Register(r.Context(), req.Email, req.Password)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	response.JSON(w, http.StatusCreated, authResponse{User: newUserResponse(user), Tokens: tokens})
}

func (h *authHandler) login(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	req, ok := decodeCredentials(w, r)
	if !ok {
		return
	}
	user, tokens, err := h.svc.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, authResponse{User: newUserResponse(user), Tokens: tokens})
}

func (h *authHandler) refresh(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var req refreshRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.RefreshToken == "" {
		response.Fail(w, http.StatusBadRequest, "validation_error", "refresh_token is required")
		return
	}
	tokens, err := h.svc.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]auth.TokenPair{"tokens": tokens})
}

func (h *authHandler) logout(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var req refreshRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.RefreshToken == "" {
		response.Fail(w, http.StatusBadRequest, "validation_error", "refresh_token is required")
		return
	}
	if err := h.svc.Logout(r.Context(), req.RefreshToken); err != nil {
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not log out")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

func (h *authHandler) me(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	user, err := h.svc.UserByID(r.Context(), userID)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]userResponse{"user": newUserResponse(user)})
}

func (h *authHandler) unavailable(w http.ResponseWriter) bool {
	if h.svc != nil {
		return false
	}
	response.Fail(w, http.StatusServiceUnavailable, "auth_unavailable", "authentication service is not configured")
	return true
}

func decodeCredentials(w http.ResponseWriter, r *http.Request) (credentialsRequest, bool) {
	var req credentialsRequest
	if !decodeJSON(w, r, &req) {
		return req, false
	}
	if req.Email == "" || req.Password == "" {
		response.Fail(w, http.StatusBadRequest, "validation_error", "email and password are required")
		return req, false
	}
	return req, true
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			response.Fail(w, http.StatusRequestEntityTooLarge, "request_too_large", "request body is too large")
		} else {
			response.Fail(w, http.StatusBadRequest, "invalid_request", "request body is not valid JSON")
		}
		return false
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		response.Fail(w, http.StatusBadRequest, "invalid_request", "request body must contain a single JSON object")
		return false
	}
	return true
}

func writeAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrInvalidEmail):
		response.Fail(w, http.StatusBadRequest, "validation_error", "email is not valid")
	case errors.Is(err, auth.ErrWeakPassword):
		response.Fail(w, http.StatusBadRequest, "validation_error", "password must be at least 8 characters")
	case errors.Is(err, auth.ErrPasswordTooLong):
		response.Fail(w, http.StatusBadRequest, "validation_error", "password must be at most 72 bytes")
	case errors.Is(err, auth.ErrEmailTaken):
		response.Fail(w, http.StatusConflict, "email_taken", "email is already registered")
	case errors.Is(err, auth.ErrInvalidCredentials):
		response.Fail(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
	case errors.Is(err, auth.ErrInvalidToken):
		response.Fail(w, http.StatusUnauthorized, "invalid_token", "invalid or expired token")
	default:
		response.Fail(w, http.StatusInternalServerError, "internal_error", "something went wrong")
	}
}
