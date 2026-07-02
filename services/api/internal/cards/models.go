package cards

import "time"

const (
	CardTypePatternRecognition = "pattern_recognition"
	CardTypeAlgorithmMechanics = "algorithm_mechanics"
	CardTypeEdgeCase           = "edge_case"

	CardStatusNew      = "new"
	CardStatusDue      = "due"
	CardStatusLearning = "learning"
	CardStatusMastered = "mastered"

	SessionScopeDue        = "due"
	SessionScopeHardNormal = "hard_normal"
	SessionScopeAll        = "all"
)

type Card struct {
	ID           int64      `json:"id"`
	Type         string     `json:"type"`
	Source       Source     `json:"source"`
	Front        string     `json:"front"`
	Back         string     `json:"back"`
	Status       string     `json:"status"`
	NextReviewAt *time.Time `json:"nextReviewAt"`
	LastRating   *string    `json:"lastRating"`
	CreatedAt    time.Time  `json:"createdAt"`
}

type Source struct {
	EntityType string `json:"entityType"`
	EntityID   *int64 `json:"entityId"`
	Label      string `json:"label"`
}

type ListMeta struct {
	NextCursor *string `json:"nextCursor"`
}

type ListParams struct {
	Limit    int32
	Type     string
	Cursor   Cursor
	PageSize int
}

type Cursor struct {
	CreatedAt time.Time
	ID        int64
}

type CardRecord struct {
	ID               int64
	Type             string
	Question         string
	Answer           string
	CreatedAt        time.Time
	SourceEntityType string
	SourceEntityID   *int64
	SourceLabel      string
	ScheduleID       *int64
	NextReviewAt     *time.Time
	LastRating       *string
	ReviewCount      int
	ReviewState      int
}

type SessionParams struct {
	Scope string
	Limit int32
}

type Session struct {
	SessionID        string        `json:"sessionId"`
	Scope            string        `json:"scope"`
	EstimatedMinutes int           `json:"estimatedMinutes"`
	Cards            []SessionCard `json:"cards"`
}

type SessionCard struct {
	ID          int64       `json:"id"`
	Type        string      `json:"type"`
	SourceLabel string      `json:"sourceLabel"`
	Front       string      `json:"front"`
	Back        string      `json:"back"`
	ReviewState ReviewState `json:"reviewState"`
}

type ReviewState struct {
	Attempts     int        `json:"attempts"`
	LastRating   *string    `json:"lastRating"`
	NextReviewAt *time.Time `json:"nextReviewAt"`
}

type RateRequest struct {
	SessionID  string `json:"sessionId"`
	Rating     string `json:"rating"`
	ReviewedAt string `json:"reviewedAt"`
}

func (r RateRequest) ValidRating() bool {
	return validRating(r.Rating)
}

type RateResult struct {
	CardID                 int64           `json:"cardId"`
	Rating                 string          `json:"rating"`
	NextReviewAt           time.Time       `json:"nextReviewAt"`
	RepeatInCurrentSession bool            `json:"repeatInCurrentSession"`
	SessionProgress        SessionProgress `json:"sessionProgress"`
}

type SessionProgress struct {
	Reviewed  int `json:"reviewed"`
	Total     int `json:"total"`
	Remaining int `json:"remaining"`
}
