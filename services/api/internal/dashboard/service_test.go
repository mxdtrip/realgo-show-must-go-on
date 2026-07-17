package dashboard

import (
	"context"
	"testing"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/patterns"
)

func TestServiceGet_EmptyUser(t *testing.T) {
	svc := NewService(fakeRepository{}, fakeWeakRepository{})

	got, err := svc.Get(context.Background(), 42)
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}

	if got.NextAction.Type != nextActionTypeRoadmapStep {
		t.Fatalf("NextAction.Type = %q, want %q", got.NextAction.Type, nextActionTypeRoadmapStep)
	}
	if got.NextAction.DueAt != nil {
		t.Fatalf("NextAction.DueAt = %v, want nil", got.NextAction.DueAt)
	}
	if len(got.Stats) != 4 {
		t.Fatalf("Stats len = %d, want 4", len(got.Stats))
	}
	assertStat(t, got.Stats[0], "today_queue", 0, "0", statToneDefault)
	assertStat(t, got.Stats[1], "solved_total", 0, "0", statToneDefault)
	assertStat(t, got.Stats[2], "streak", 0, "0", statToneDefault)
	assertStat(t, got.Stats[3], "readiness", 0, "0%", statToneDefault)
	if got.ReviewPreview == nil {
		t.Fatal("ReviewPreview must be an empty array, not null")
	}
	if len(got.ReviewPreview) != 0 {
		t.Fatalf("ReviewPreview len = %d, want 0", len(got.ReviewPreview))
	}
	if got.WeakPatterns == nil {
		t.Fatal("WeakPatterns must be an empty array, not null")
	}
	if len(got.WeakPatterns) != 0 {
		t.Fatalf("WeakPatterns len = %d, want 0", len(got.WeakPatterns))
	}
	if got.Activity.Days == nil {
		t.Fatal("Activity.Days must be an empty array, not null")
	}
	if got.Activity.ActiveDays != 0 || got.Activity.TotalReviews != 0 {
		t.Fatalf("Activity = %+v, want zeroes", got.Activity)
	}
}

func TestServiceGet_ActivityAggregates(t *testing.T) {
	repo := fakeRepository{
		activity: []ActivityDay{
			{Date: "2026-07-08", Count: 3},
			{Date: "2026-07-09", Count: 1},
			{Date: "2026-07-10", Count: 6},
		},
	}
	svc := NewService(repo, fakeWeakRepository{})

	got, err := svc.Get(context.Background(), 42)
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}

	if got.Activity.ActiveDays != 3 {
		t.Fatalf("ActiveDays = %d, want 3", got.Activity.ActiveDays)
	}
	if got.Activity.TotalReviews != 10 {
		t.Fatalf("TotalReviews = %d, want 10", got.Activity.TotalReviews)
	}
	if len(got.Activity.Days) != 3 || got.Activity.Days[2].Date != "2026-07-10" {
		t.Fatalf("Days = %+v", got.Activity.Days)
	}
}

func TestServiceGet_UserWithData(t *testing.T) {
	dueAt := time.Date(2026, 6, 30, 9, 30, 0, 0, time.UTC)
	lastRating := "hard"
	repo := fakeRepository{
		metrics: Metrics{
			DueCount:        3,
			DueProblemCount: 2,
			DueCardCount:    1,
			SolvedCount:     12,
			ProgressCount:   12,
			Readiness:       68,
			CurrentStreak:   4,
		},
		reviews: []ReviewPreview{
			{
				ID:          99,
				EntityType:  "problem",
				Title:       "Longest Substring Without Repeating Characters",
				PatternName: "Sliding Window",
				Difficulty:  "medium",
				DueAt:       dueAt,
				LastRating:  &lastRating,
				Attempts:    5,
			},
		},
		nextReview: &ReviewPreview{
			ID:         99,
			EntityType: "problem",
			Title:      "Longest Substring Without Repeating Characters",
			DueAt:      dueAt,
		},
	}
	weakRepo := fakeWeakRepository{
		items: []patterns.WeakPattern{
			{PatternCode: "sliding_window", Pattern: "Sliding Window", HardCount: 3, ReviewCount: 4},
		},
	}
	svc := NewService(repo, weakRepo)

	got, err := svc.Get(context.Background(), 42)
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}

	if got.NextAction.Type != nextActionTypeProblemReview {
		t.Fatalf("NextAction.Type = %q, want %q", got.NextAction.Type, nextActionTypeProblemReview)
	}
	if got.NextAction.Title != "3 повторений на сегодня" {
		t.Fatalf("NextAction.Title = %q", got.NextAction.Title)
	}
	if got.NextAction.Href != "/reviews" {
		t.Fatalf("NextAction.Href = %q, want /reviews", got.NextAction.Href)
	}
	if got.NextAction.DueAt == nil || !got.NextAction.DueAt.Equal(dueAt) {
		t.Fatalf("NextAction.DueAt = %v, want %v", got.NextAction.DueAt, dueAt)
	}

	assertStat(t, got.Stats[0], "today_queue", 3, "3", statToneAccent)
	assertStat(t, got.Stats[1], "solved_total", 12, "12", statToneDefault)
	assertStat(t, got.Stats[2], "streak", 4, "4", statToneAccent)
	assertStat(t, got.Stats[3], "readiness", 68, "68%", statToneWarning)

	if len(got.ReviewPreview) != 1 {
		t.Fatalf("ReviewPreview len = %d, want 1", len(got.ReviewPreview))
	}
	review := got.ReviewPreview[0]
	if review.ID != "99" {
		t.Fatalf("review ID = %q, want 99", review.ID)
	}
	if review.Type != nextActionTypeProblemReview {
		t.Fatalf("review Type = %q, want %q", review.Type, nextActionTypeProblemReview)
	}
	if review.Meta != "Sliding Window · medium" {
		t.Fatalf("review Meta = %q", review.Meta)
	}
	if review.LastRating == nil || *review.LastRating != "hard" {
		t.Fatalf("review LastRating = %#v, want hard", review.LastRating)
	}

	if len(got.WeakPatterns) != 1 {
		t.Fatalf("WeakPatterns len = %d, want 1", len(got.WeakPatterns))
	}
	weak := got.WeakPatterns[0]
	if weak.ID != "pat_sliding_window" {
		t.Fatalf("weak ID = %q, want pat_sliding_window", weak.ID)
	}
	if weak.Confidence != 25 {
		t.Fatalf("weak Confidence = %d, want 25", weak.Confidence)
	}
	if weak.Signal != "3 hard из 4 повторений" {
		t.Fatalf("weak Signal = %q", weak.Signal)
	}
}

func assertStat(t *testing.T, stat Stat, key string, value int, displayValue string, tone string) {
	t.Helper()
	if stat.Key != key {
		t.Fatalf("stat key = %q, want %q", stat.Key, key)
	}
	if stat.Value != value {
		t.Fatalf("stat %s value = %d, want %d", key, stat.Value, value)
	}
	if stat.DisplayValue != displayValue {
		t.Fatalf("stat %s displayValue = %q, want %q", key, stat.DisplayValue, displayValue)
	}
	if stat.Tone != tone {
		t.Fatalf("stat %s tone = %q, want %q", key, stat.Tone, tone)
	}
}

type fakeRepository struct {
	metrics    Metrics
	activity   []ActivityDay
	reviews    []ReviewPreview
	nextReview *ReviewPreview
}

func (f fakeRepository) GetMetrics(context.Context, int64) (Metrics, error) {
	return f.metrics, nil
}

func (f fakeRepository) ListActivity(context.Context, int64, int32) ([]ActivityDay, error) {
	if f.activity == nil {
		return []ActivityDay{}, nil
	}
	return f.activity, nil
}

func (f fakeRepository) ListReviewPreview(context.Context, int64, int32) ([]ReviewPreview, error) {
	if f.reviews == nil {
		return []ReviewPreview{}, nil
	}
	return f.reviews, nil
}

func (f fakeRepository) GetNextReview(context.Context, int64) (*ReviewPreview, error) {
	return f.nextReview, nil
}

type fakeWeakRepository struct {
	items []patterns.WeakPattern
}

func (f fakeWeakRepository) ListWeak(context.Context, int64, int32) ([]patterns.WeakPattern, error) {
	if f.items == nil {
		return []patterns.WeakPattern{}, nil
	}
	return f.items, nil
}
