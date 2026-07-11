package dashboard

import "time"

const (
	nextActionTypeCardSession   = "card_session"
	nextActionTypeProblemReview = "problem_review"
	nextActionTypePatternReview = "pattern_review"
	nextActionTypeRoadmapStep   = "roadmap_step"

	reviewPreviewTypeCard    = "card_review"
	reviewPreviewTypeProblem = "problem_review"
	reviewPreviewTypePattern = "pattern_review"

	statToneDefault = "default"
	statToneAccent  = "accent"
	statToneSuccess = "success"
	statToneWarning = "warning"
	statToneDanger  = "danger"
)

type Response struct {
	NextAction    NextAction          `json:"nextAction"`
	Stats         []Stat              `json:"stats"`
	ReviewPreview []ReviewPreviewItem `json:"reviewPreview"`
	WeakPatterns  []WeakPattern       `json:"weakPatterns"`
	Activity      Activity            `json:"activity"`
}

// Activity feeds the dashboard heatmap: per-day counts over the last
// activityWindowDays days (user timezone), oldest first. Days with no
// activity are omitted from Days.
type Activity struct {
	Days         []ActivityDay `json:"days"`
	ActiveDays   int           `json:"activeDays"`
	TotalReviews int           `json:"totalReviews"`
}

type ActivityDay struct {
	Date  string `json:"date"` // YYYY-MM-DD in the user's timezone
	Count int    `json:"count"`
}

type NextAction struct {
	Type        string     `json:"type"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Href        string     `json:"href"`
	DueAt       *time.Time `json:"dueAt,omitempty"`
}

type Stat struct {
	Key          string `json:"key"`
	Label        string `json:"label"`
	Value        int    `json:"value"`
	DisplayValue string `json:"displayValue"`
	Hint         string `json:"hint"`
	Tone         string `json:"tone"`
}

type ReviewPreviewItem struct {
	ID         string    `json:"id"`
	Type       string    `json:"type"`
	Title      string    `json:"title"`
	Meta       string    `json:"meta"`
	DueAt      time.Time `json:"dueAt"`
	LastRating *string   `json:"lastRating"`
}

type WeakPattern struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Confidence int    `json:"confidence"`
	Signal     string `json:"signal"`
}

type Metrics struct {
	DueCount        int
	DueProblemCount int
	DueCardCount    int
	DuePatternCount int
	SolvedCount     int
	ProgressCount   int
	Readiness       int
	CurrentStreak   int
}

type ReviewPreview struct {
	ID          int64
	EntityType  string
	Title       string
	PatternName string
	Difficulty  string
	DueAt       time.Time
	LastRating  *string
	Attempts    int
}
