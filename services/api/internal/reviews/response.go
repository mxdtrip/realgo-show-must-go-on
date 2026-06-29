package reviews

import "time"

type TodayReviewsResponse struct {
	Data []ReviewItem `json:"data"`
}

type ReviewItem struct {
	ID           int64     `json:"id"`
	ProblemID    int64     `json:"problem_id"`
	ProblemTitle string    `json:"problem_title"`
	ProblemURL   string    `json:"problem_url"`
	NextReviewAt time.Time `json:"next_review_at"`
	State        int8      `json:"state"`
}

type AttemptResponse struct {
	ScheduleID   int64     `json:"schedule_id"`
	NextReviewAt time.Time `json:"next_review_at"`
	IntervalDays float64   `json:"interval_days"`
	Stability    float64   `json:"stability"`
	Difficulty   float64   `json:"difficulty"`
	State        int8      `json:"state"`
	Reps         int       `json:"reps"`
	Lapses       int       `json:"lapses"`
}

type StatsResponse struct {
	Data StatsData `json:"data"`
}

type StatsData struct {
	TotalReviews  int `json:"total_reviews"`
	NewCards      int `json:"new_cards"`
	LearningCards int `json:"learning_cards"`
	ReviewCards   int `json:"review_cards"`
}
