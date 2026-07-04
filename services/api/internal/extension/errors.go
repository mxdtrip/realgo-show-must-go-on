package extension

import "errors"

// Domain errors surfaced by the service; the handler maps them to HTTP codes.
var (
	// ErrValidation marks a malformed or incomplete event payload (→ 400).
	ErrValidation = errors.New("extension: invalid event payload")
	// ErrUnknownPlatform marks an unrecognised source/platform code (→ 422).
	ErrUnknownPlatform = errors.New("extension: unknown platform source")
)
