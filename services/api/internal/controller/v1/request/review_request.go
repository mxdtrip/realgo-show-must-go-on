package request

// RateReviewRequest для POST /me/reviews/{reviewId}/rate
type RateReviewRequest struct {
	Rating     string `json:"rating"`     // hard, normal, easy
	ReviewedAt string `json:"reviewedAt"` // ISO 8601
}

// Valid проверяет корректность рейтинга
func (r RateReviewRequest) Valid() bool {
	switch r.Rating {
	case "hard", "normal", "easy":
		return true
	default:
		return false
	}
}
