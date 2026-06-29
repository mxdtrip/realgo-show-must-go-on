package reviews

import (
	"context"
	"testing"
	"time"
)

func TestProcessAttemptStoresProductRating(t *testing.T) {
	problemID := int64(9)
	repo := &fakeRepository{
		schedule: ReviewSchedule{
			ID: 1,
			ReviewBase: ReviewBase{
				UserID:       7,
				ReviewTarget: ReviewTarget{ProblemID: &problemID},
			},
			NextReviewAt: time.Now(),
			State:        0,
		},
	}
	svc := NewService(repo, nil)

	resp, err := svc.ProcessAttempt(context.Background(), 1, 7, AttemptRequest{Rating: "normal", DurationSec: 12})
	if err != nil {
		t.Fatalf("ProcessAttempt: %v", err)
	}

	if repo.attempt.Rating != "normal" {
		t.Fatalf("expected normal rating, got %q", repo.attempt.Rating)
	}
	if resp.ScheduleID != 1 {
		t.Fatalf("expected schedule 1, got %d", resp.ScheduleID)
	}
}

type fakeRepository struct {
	schedule ReviewSchedule
	attempt  ReviewAttempt
}

func (r *fakeRepository) TodayReviews(context.Context, int64, int32) ([]ReviewItem, error) {
	return nil, nil
}

func (r *fakeRepository) ScheduleByID(context.Context, int64, int64) (ReviewSchedule, error) {
	return r.schedule, nil
}

func (r *fakeRepository) SaveReview(_ context.Context, schedule ReviewSchedule, attempt ReviewAttempt) (ReviewSchedule, error) {
	r.schedule = schedule
	r.attempt = attempt
	return schedule, nil
}

func (r *fakeRepository) Stats(context.Context, int64) (StatsData, error) {
	return StatsData{}, nil
}
