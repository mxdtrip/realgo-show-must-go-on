package reviews

import "errors"

var (
	ErrInvalidRating  = errors.New("rating must be one of: hard, normal, easy")
	ErrReviewNotFound = errors.New("review not found")
	ErrInvalidTarget  = errors.New("review target must have exactly one of problem_id or pattern_id")
)
