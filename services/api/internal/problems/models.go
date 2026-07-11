package problems

import (
	"errors"
	"time"
)

var errNotFound = errors.New("problem not found")

// ProblemDetail is returned by GET /me/problems/{id}. It is a strict superset
// of Problem (list): every list field is present with the same JSON key, plus
// Note. Casing is camelCase to match the list model, the contract doc and both
// frontends (issue #243).
type ProblemDetail struct {
	ID           int64           `json:"id"`
	ExternalID   string          `json:"externalId"`
	Title        string          `json:"title"`
	URL          string          `json:"url"`
	Platform     string          `json:"platform"`
	Difficulty   string          `json:"difficulty"`
	Pattern      *ProblemPattern `json:"pattern"`
	Status       string          `json:"status"`
	NextReviewAt *time.Time      `json:"nextReviewAt"`
	LastRating   *string         `json:"lastRating"`
	SolvedAt     *time.Time      `json:"solvedAt"`
	HintsUsed    int             `json:"hintsUsed"`
	Note         *string         `json:"note"`
	CreatedAt    time.Time       `json:"createdAt"`
	UpdatedAt    time.Time       `json:"updatedAt"`
}

type Problem struct {
	ID           int64           `json:"id"`
	ExternalID   string          `json:"externalId"`
	Title        string          `json:"title"`
	URL          string          `json:"url"`
	Platform     string          `json:"platform"`
	Difficulty   string          `json:"difficulty"`
	Pattern      *ProblemPattern `json:"pattern"`
	Status       string          `json:"status"`
	NextReviewAt *time.Time      `json:"nextReviewAt"`
	LastRating   *string         `json:"lastRating"`
	SolvedAt     *time.Time      `json:"solvedAt"`
	// HintsUsed — сколько подсказок ассистента реально выдано по задаче
	// (успешные assistant_hint-запросы этого пользователя).
	HintsUsed int       `json:"hintsUsed"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type ProblemPattern struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ListResponse struct {
	Data []Problem `json:"data"`
	Meta ListMeta  `json:"meta"`
}

type ListMeta struct {
	NextCursor *string `json:"nextCursor"`
}

type ListParams struct {
	Limit    int32
	Status   string
	Platform string
	Cursor   Cursor
}

type Cursor struct {
	CreatedAt time.Time
	ID        int64
}
