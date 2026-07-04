package server

import (
	"context"
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
	Locale   string `json:"locale,omitempty"`
	Timezone string `json:"timezone,omitempty"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type profileResponse struct {
	PrepGoal       *string `json:"prep_goal"`
	Grade          *string `json:"grade"`
	TargetCompany  *string `json:"target_company"`
	TargetPosition *string `json:"target_position"`
}

type notificationSettingsResponse struct {
	ReviewReminder bool `json:"review_reminder"`
	WeeklyDigest   bool `json:"weekly_digest"`
	EmailEnabled   bool `json:"email_enabled"`
}

type userResponse struct {
	ID                   int64                        `json:"id"`
	Email                string                       `json:"email"`
	Timezone             string                       `json:"timezone"`
	Plan                 string                       `json:"plan"`
	InterviewDate        *string                      `json:"interview_date"`
	CreatedAt            string                       `json:"created_at"`
	OnboardingCompleted  bool                         `json:"onboarding_completed"`
	Profile              profileResponse              `json:"profile"`
	NotificationSettings notificationSettingsResponse `json:"notification_settings"`
}

type authResponse struct {
	User   userResponse   `json:"user"`
	Tokens auth.TokenPair `json:"tokens"`
}

func newUserResponse(u db.User) userResponse {
	resp := userResponse{
		ID:                  u.ID,
		Email:               u.Email,
		Timezone:            u.Timezone.String,
		Plan:                u.Plan.String,
		OnboardingCompleted: u.OnboardingCompletedAt.Valid,
		NotificationSettings: notificationSettingsResponse{
			ReviewReminder: u.NotifyReviewReminder,
			WeeklyDigest:   u.NotifyWeeklyDigest,
			EmailEnabled:   u.NotifyEmailEnabled,
		},
	}
	if u.CreatedAt.Valid {
		resp.CreatedAt = u.CreatedAt.Time.UTC().Format(time.RFC3339)
	}
	if u.InterviewDate.Valid {
		d := u.InterviewDate.Time.UTC().Format(time.RFC3339)
		resp.InterviewDate = &d
	}
	if u.PrepGoal.Valid {
		resp.Profile.PrepGoal = &u.PrepGoal.String
	}
	if u.Grade.Valid {
		resp.Profile.Grade = &u.Grade.String
	}
	if u.TargetCompany.Valid {
		resp.Profile.TargetCompany = &u.TargetCompany.String
	}
	if u.TargetPosition.Valid {
		resp.Profile.TargetPosition = &u.TargetPosition.String
	}
	return resp
}

func (h *authHandler) register(w http.ResponseWriter, r *http.Request) {
	h.handleCredentials(w, r, h.svc.Register, http.StatusCreated)
}

func (h *authHandler) login(w http.ResponseWriter, r *http.Request) {
	h.handleCredentials(w, r, h.svc.Login, http.StatusOK)
}

func (h *authHandler) handleCredentials(
	w http.ResponseWriter,
	r *http.Request,
	fn func(context.Context, string, string) (db.User, auth.TokenPair, error),
	status int,
) {
	if h.unavailable(w) {
		return
	}
	req, ok := decodeCredentials(w, r)
	if !ok {
		return
	}
	user, tokens, err := fn(r.Context(), req.Email, req.Password)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	response.JSON(w, status, authResponse{User: newUserResponse(user), Tokens: tokens})
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
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "refresh_token is required", "refresh_token")
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
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "refresh_token is required", "refresh_token")
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
	if req.Email == "" {
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "email is required", "email")
		return req, false
	}
	if req.Password == "" {
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "password is required", "password")
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

type patchProfileRequest struct {
	Timezone            *string `json:"timezone"`
	InterviewDate       *string `json:"interview_date"`
	PrepGoal            *string `json:"prep_goal"`
	Grade               *string `json:"grade"`
	TargetCompany       *string `json:"target_company"`
	TargetPosition      *string `json:"target_position"`
	OnboardingCompleted *bool   `json:"onboarding_completed"`
}

var validGrades = map[string]bool{
	"junior": true, "middle": true, "senior": true, "staff": true, "principal": true,
}

// validTimezone accepts IANA zone names (e.g. "Europe/Moscow", "UTC"). The
// value ends up in Postgres `AT TIME ZONE` expressions (dashboard metrics), so
// an unvalidated string would make those queries fail with a database error on
// every request for that user. Go's "Local" pseudo-zone is rejected for the
// same reason: Postgres does not recognise it.
func validTimezone(tz string) bool {
	if tz == "Local" {
		return false
	}
	_, err := time.LoadLocation(tz)
	return err == nil
}

// patchProfile handles PATCH /me/profile — a partial update of the onboarding
// profile. Omitted fields are left untouched; an explicit value (including "")
// overwrites the field.
func (h *authHandler) patchProfile(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req patchProfileRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.Grade != nil && *req.Grade != "" && !validGrades[*req.Grade] {
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "grade must be one of: junior, middle, senior, staff, principal", "grade")
		return
	}
	if req.Timezone != nil && *req.Timezone != "" && !validTimezone(*req.Timezone) {
		response.Fail(w, http.StatusBadRequest, "validation_error", "timezone must be a valid IANA time zone, e.g. Europe/Moscow")
		return
	}

	upd := auth.ProfileUpdate{
		Timezone:       req.Timezone,
		PrepGoal:       req.PrepGoal,
		Grade:          req.Grade,
		TargetCompany:  req.TargetCompany,
		TargetPosition: req.TargetPosition,
	}
	if req.InterviewDate != nil {
		t, err := time.Parse(time.RFC3339, *req.InterviewDate)
		if err != nil {
			response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "interview_date must be RFC3339", "interview_date")
			return
		}
		upd.InterviewDate = &t
	}
	if req.OnboardingCompleted != nil && *req.OnboardingCompleted {
		upd.SetOnboardingDone = true
	}

	user, err := h.svc.UpdateProfile(r.Context(), userID, upd)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]userResponse{"user": newUserResponse(user)})
}

type patchNotificationSettingsRequest struct {
	ReviewReminder *bool `json:"review_reminder"`
	WeeklyDigest   *bool `json:"weekly_digest"`
	EmailEnabled   *bool `json:"email_enabled"`
}

// patchNotificationSettings handles PATCH /me/notification-settings.
func (h *authHandler) patchNotificationSettings(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req patchNotificationSettingsRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.ReviewReminder == nil && req.WeeklyDigest == nil && req.EmailEnabled == nil {
		response.Fail(w, http.StatusBadRequest, "validation_error", "at least one field is required")
		return
	}

	user, err := h.svc.UpdateNotificationSettings(r.Context(), userID, auth.NotificationSettings{
		ReviewReminder: req.ReviewReminder,
		WeeklyDigest:   req.WeeklyDigest,
		EmailEnabled:   req.EmailEnabled,
	})
	if err != nil {
		writeAuthError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]userResponse{"user": newUserResponse(user)})
}

// postExport handles POST /me/export. MVP stub: real generation and email
// delivery are post-MVP; the endpoint acknowledges the request only.
func (h *authHandler) postExport(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	if _, ok := auth.UserIDFromContext(r.Context()); !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	response.JSON(w, http.StatusAccepted, map[string]string{
		"status":  "accepted",
		"message": "data export is not implemented yet",
	})
}

type deleteMeRequest struct {
	Password     string `json:"password"`
	RefreshToken string `json:"refresh_token"`
}

// deleteMe handles DELETE /me. Account removal is irreversible, so it requires
// the current password for confirmation.
func (h *authHandler) deleteMe(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	var req deleteMeRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Password == "" {
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "password is required to delete the account", "password")
		return
	}

	if err := h.svc.DeleteAccount(r.Context(), userID, req.Password, req.RefreshToken); err != nil {
		writeAuthError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func writeAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrInvalidEmail):
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "email is not valid", "email")
	case errors.Is(err, auth.ErrWeakPassword):
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "password must be at least 8 characters", "password")
	case errors.Is(err, auth.ErrPasswordTooLong):
		response.FailWithDetails(w, http.StatusBadRequest, "validation_error", "password must be at most 72 bytes", "password")
	case errors.Is(err, auth.ErrEmailTaken):
		response.FailWithDetails(w, http.StatusConflict, "email_taken", "email is already registered", "email")
	case errors.Is(err, auth.ErrInvalidCredentials):
		response.Fail(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
	case errors.Is(err, auth.ErrInvalidToken):
		response.Fail(w, http.StatusUnauthorized, "invalid_token", "invalid or expired token")
	default:
		response.Fail(w, http.StatusInternalServerError, "internal_error", "something went wrong")
	}
}
