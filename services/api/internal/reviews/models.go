package reviews

import "time"

type ReviewTarget struct {
	ProblemID *int64
	PatternID *int64
}

type ReviewBase struct {
	UserID int64
	ReviewTarget
}

type ReviewSchedule struct {
	ID int64
	ReviewBase
	NextReviewAt   time.Time
	IntervalDays   float64
	Stability      float64
	Difficulty     float64
	ReviewCount    int
	LastRating     *string
	State          int8
	Lapses         int
	LastReviewAt   *time.Time
	RemainingSteps int
}

type ReviewAttempt struct {
	ReviewBase
	Rating      string
	DurationSec int
}
