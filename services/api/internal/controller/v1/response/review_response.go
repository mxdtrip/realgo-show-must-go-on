package response

import "time"

// QueueResponse для GET /me/reviews/queue
type QueueResponse struct {
	Data []ReviewItem `json:"data"`
	Meta QueueMeta    `json:"meta"`
}

// ReviewItem для элемента очереди
type ReviewItem struct {
	ID         int64     `json:"id"`
	EntityType string    `json:"entityType"` // problem, card, pattern
	EntityID   int64     `json:"entityId"`
	Title      string    `json:"title"`
	Meta       string    `json:"meta"`
	TypeLabel  string    `json:"typeLabel"`
	DueAt      time.Time `json:"dueAt"`
	Status     string    `json:"status"` // due, upcoming, completed
	LastRating *string   `json:"lastRating"`
	Attempts   int       `json:"attempts"`
}

// QueueMeta для пагинации
type QueueMeta struct {
	NextCursor *string `json:"nextCursor"`
}

// RateReviewResponse для POST /me/reviews/{reviewId}/rate
type RateReviewResponse struct {
	ReviewID     int64     `json:"reviewId"`
	Rating       string    `json:"rating"`
	NextReviewAt time.Time `json:"nextReviewAt"`
	Status       string    `json:"status"` // completed
}

// StatsResponse для GET /me/reviews/stats
type StatsResponse struct {
	TotalReviews  int `json:"totalReviews"`
	NewCards      int `json:"newCards"`
	LearningCards int `json:"learningCards"`
	ReviewCards   int `json:"reviewCards"`
}
