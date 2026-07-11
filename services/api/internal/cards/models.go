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
	SessionScopePractice   = "practice"
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
	CreatedByAI  bool       `json:"createdByAi"`
	CreatedAt    time.Time  `json:"createdAt"`
}

type Source struct {
	EntityType string `json:"entityType"`
	EntityID   *int64 `json:"entityId"`
	Label      string `json:"label"`
}

type seedCard struct {
	ID           string     `json:"id"`
	URL          string     `json:"url"`
	Type         string     `json:"type"`
	Source       seedSource `json:"source"`
	Front        string     `json:"front"`
	Back         string     `json:"back"`
	Status       string     `json:"status"`
	NextReviewAt *time.Time `json:"nextReviewAt"`
	LastRating   *string    `json:"lastRating"`
	CreatedAt    time.Time  `json:"createdAt"`
}

type seedSource struct {
	EntityType string `json:"entityType"`
	EntityID   string `json:"entityId"`
	Label      string `json:"label"`
}

type ListMeta struct {
	NextCursor *string `json:"nextCursor"`
}

type ListParams struct {
	Limit       int32
	Type        string
	PatternCode string
	Cursor      Cursor
	PageSize    int
}

type Cursor struct {
	CreatedAt time.Time
	ID        int64
}

type CardRecord struct {
	ID               int64
	Type             string
	Front            string
	Back             string
	CreatedByAI      bool
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
	Scope       string
	PatternCode string
	Limit       int32
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
	CreatedByAI bool        `json:"createdByAi"`
	ReviewState ReviewState `json:"reviewState"`
}

type ReviewState struct {
	Attempts     int        `json:"attempts"`
	LastRating   *string    `json:"lastRating"`
	NextReviewAt *time.Time `json:"nextReviewAt"`
}

// DueSummary is the un-capped due-today breakdown used by the /cards
// launcher's "Что повторяем сегодня" panel, distinct from Session (which
// caps at session_limit — one review session's worth, not "how many are
// due today").
type DueSummary struct {
	TotalDue         int              `json:"totalDue"`
	EstimatedMinutes int              `json:"estimatedMinutes"`
	ByType           []DueTypeSummary `json:"byType"`
}

type DueTypeSummary struct {
	Type  string `json:"type"`
	Count int    `json:"count"`
	// SampleLabels holds up to 3 source titles (soonest-due first) so the UI
	// can show what's due without fetching every card's full content.
	SampleLabels []string `json:"sampleLabels"`
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

// --- CRUD types ---

// CreateCardInput is the input for creating a new card.
type CreateCardInput struct {
	Type        string
	Front       string
	Back        string
	Explanation *string
	SourceText  *string
	ProblemID   *int64
	PatternID   *int64
}

// UpdateCardInput contains the fields that may be patched on a card.
type UpdateCardInput struct {
	Type        *string
	Front       *string
	Back        *string
	Explanation *string
	SourceText  *string
}

// CardDetail is returned by CRUD endpoints and includes join fields.
type CardDetail struct {
	ID           int64     `json:"id"`
	Type         string    `json:"type"`
	Front        string    `json:"front"`
	Back         string    `json:"back"`
	Explanation  *string   `json:"explanation"`
	Source       Source    `json:"source"`
	CreatedByAI  bool      `json:"createdByAi"`
	CreatedAt    time.Time `json:"createdAt"`
	ProblemTitle *string   `json:"problemTitle"`
	ProblemURL   *string   `json:"problemUrl"`
	PatternName  *string   `json:"patternName"`
}

// HTTP request types used by CRUD handlers only.
type createCardRequest struct {
	Type        string  `json:"type"`
	Front       string  `json:"front"`
	Back        string  `json:"back"`
	Explanation *string `json:"explanation"`
	SourceText  *string `json:"sourceText"`
	ProblemID   *int64  `json:"problemId"`
	PatternID   *int64  `json:"patternId"`
}

type updateCardRequest struct {
	Type        *string `json:"type"`
	Front       *string `json:"front"`
	Back        *string `json:"back"`
	Explanation *string `json:"explanation"`
	SourceText  *string `json:"sourceText"`
}
