package reviews

import (
	"errors"
	"testing"
)

func TestReviewTypeRejectsAmbiguousTarget(t *testing.T) {
	problemID := int64(1)
	patternID := int64(2)

	_, err := reviewType(ReviewTarget{ProblemID: &problemID, PatternID: &patternID})
	if !errors.Is(err, ErrInvalidTarget) {
		t.Fatalf("expected ErrInvalidTarget, got %v", err)
	}
}
