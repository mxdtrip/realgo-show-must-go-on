package entity

import "time"

// ReviewSchedule представляет расписание повторения для FSRS.
type ReviewSchedule struct {
	ID             int64
	UserID         int64
	ProblemID      *int64
	PatternID      *int64
	CardID         *int64 // Карточка для тренировки паттернов
	NextReviewAt   time.Time
	IntervalDays   float64
	Stability      float64
	Difficulty     float64
	ReviewCount    int
	LastRating     *string
	State          int8 // 0=New, 1=Learning, 2=Review, 3=Relearning
	Lapses         int
	LastReviewAt   *time.Time
	RemainingSteps int
}

// ReviewAttempt представляет попытку повторения.
type ReviewAttempt struct {
	ID          int64
	UserID      int64
	ProblemID   *int64
	PatternID   *int64
	CardID      *int64 // Карточка для тренировки паттернов
	Rating      string // hard, normal, easy
	ReviewType  string // problem, pattern, card
	DurationSec int
	WasCorrect  bool
	CreatedAt   time.Time
}

// ReviewItem для ответа API (очередь повторений).
type ReviewItem struct {
	ID         int64     `json:"id"`
	EntityType string    `json:"entityType"`  // problem, card, pattern
	EntityID   int64     `json:"entityId"`
	Title      string    `json:"title"`
	Meta       string    `json:"meta"`
	TypeLabel  string    `json:"typeLabel"`
	DueAt      time.Time `json:"dueAt"`
	Status     string    `json:"status"` // due, upcoming, completed
	LastRating *string   `json:"lastRating"`
	Attempts   int       `json:"attempts"`
}

// StatsData для статистики повторений.
type StatsData struct {
	TotalReviews  int `json:"totalReviews"`
	NewCards      int `json:"newCards"`
	LearningCards int `json:"learningCards"`
	ReviewCards   int `json:"reviewCards"`
}
