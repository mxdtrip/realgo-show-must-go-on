package problems

import (
	"errors"
	"time"
)

var errNotFound = errors.New("problem not found")

// ProblemDetail is returned by GET /me/problems/{id}.
type ProblemDetail struct {
	ID           int64           `json:"id"`
	ExternalID   string          `json:"external_id"`
	Title        string          `json:"title"`
	URL          string          `json:"url"`
	Platform     string          `json:"platform"`
	Difficulty   string          `json:"difficulty"`
	Pattern      *ProblemPattern `json:"pattern"`
	Status       string          `json:"status"`
	NextReviewAt *time.Time      `json:"next_review_at"`
	LastRating   *string         `json:"last_rating"`
	SolvedAt     *time.Time      `json:"solved_at"`
	Note         *string         `json:"note"`
	CreatedAt    time.Time       `json:"created_at"`
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
	CreatedAt    time.Time       `json:"createdAt"`
	UpdatedAt    time.Time       `json:"updatedAt"`
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
