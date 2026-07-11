// Package problemcards implements GET /me/problems/{problemId}/cards: the
// polling contract web (#228) builds its AI-card generation status badge
// against, per the coordinator contract fixed in this ticket.
package problemcards

import (
	"errors"

	"github.com/mxdtrip/freeburger/services/api/internal/cards"
)

const (
	StatusReady      = "ready"
	StatusGenerating = "generating"
	StatusNone       = "none"
)

var ErrProblemNotFound = errors.New("problem not found")

// Response is the GET /me/problems/{problemId}/cards payload.
type Response struct {
	Status string       `json:"status"`
	Cards  []cards.Card `json:"cards"`
}
