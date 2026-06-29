package auth

import "errors"

// Sentinel errors returned by the service. The HTTP layer maps each of these to
// a status code and a stable error code in the response envelope.
var (
	ErrInvalidEmail       = errors.New("invalid email")
	ErrWeakPassword       = errors.New("password too short")
	ErrPasswordTooLong    = errors.New("password too long")
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrInvalidToken       = errors.New("invalid or expired token")
)
