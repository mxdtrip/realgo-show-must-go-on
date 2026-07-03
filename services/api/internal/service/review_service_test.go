package service_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/entity"
	"github.com/mxdtrip/freeburger/services/api/internal/repo"
	"github.com/mxdtrip/freeburger/services/api/internal/service"
)

func TestReviewService_GetQueue_DelegatesToRepo(t *testing.T) {
	mockRepo := &mockReviewRepository{
		items: []entity.ReviewItem{
			{ID: 1, Title: "Test Problem"},
		},
	}
	svc := service.NewReviewService(mockRepo, nil)

	resp, err := svc.GetQueue(context.Background(), 1, "due", entity.FirstReviewQueueCursor(), 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(resp.Data) != 1 {
		t.Errorf("expected 1 item, got %d", len(resp.Data))
	}

	if !mockRepo.called {
		t.Error("expected repo to be called")
	}
}

func TestReviewService_GetQueue_RequestsOneExtraRowToDetectNextPage(t *testing.T) {
	mockRepo := &mockReviewRepository{items: []entity.ReviewItem{{ID: 1}}}
	svc := service.NewReviewService(mockRepo, nil)

	cursor := entity.ReviewQueueCursor{NextReviewAt: time.Unix(1000, 0), ID: 7}
	if _, err := svc.GetQueue(context.Background(), 1, "due", cursor, 10); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if mockRepo.gotLimit != 11 {
		t.Errorf("expected repo to be asked for limit+1=11, got %d", mockRepo.gotLimit)
	}
	if mockRepo.gotCursor != cursor {
		t.Errorf("expected cursor %+v to be forwarded, got %+v", cursor, mockRepo.gotCursor)
	}
}

func TestReviewService_GetQueue_NextCursorSetWhenMoreItemsExist(t *testing.T) {
	dueAt1 := time.Date(2026, 7, 4, 10, 0, 0, 0, time.UTC)
	dueAt2 := time.Date(2026, 7, 4, 11, 0, 0, 0, time.UTC)
	mockRepo := &mockReviewRepository{
		items: []entity.ReviewItem{
			{ID: 1, DueAt: dueAt1},
			{ID: 2, DueAt: dueAt2},
		},
	}
	svc := service.NewReviewService(mockRepo, nil)

	resp, err := svc.GetQueue(context.Background(), 1, "due", entity.FirstReviewQueueCursor(), 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(resp.Data) != 1 {
		t.Fatalf("expected page to be truncated to limit=1, got %d items", len(resp.Data))
	}
	if resp.Data[0].ID != 1 {
		t.Errorf("expected first item ID 1, got %d", resp.Data[0].ID)
	}
	if resp.Meta.NextCursor == nil {
		t.Fatal("expected NextCursor to be set when more items exist")
	}

	decoded, err := entity.DecodeReviewQueueCursor(*resp.Meta.NextCursor)
	if err != nil {
		t.Fatalf("expected decodable cursor: %v", err)
	}
	if decoded.ID != 1 || !decoded.NextReviewAt.Equal(dueAt1) {
		t.Errorf("expected cursor to point at last returned item (id=1, dueAt=%v), got %+v", dueAt1, decoded)
	}
}

func TestReviewService_GetQueue_NextCursorNilOnLastPage(t *testing.T) {
	mockRepo := &mockReviewRepository{
		items: []entity.ReviewItem{{ID: 1}, {ID: 2}},
	}
	svc := service.NewReviewService(mockRepo, nil)

	resp, err := svc.GetQueue(context.Background(), 1, "due", entity.FirstReviewQueueCursor(), 5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(resp.Data) != 2 {
		t.Fatalf("expected 2 items, got %d", len(resp.Data))
	}
	if resp.Meta.NextCursor != nil {
		t.Errorf("expected nil NextCursor on last page, got %q", *resp.Meta.NextCursor)
	}
}

func TestReviewService_GetQueue_RepoError(t *testing.T) {
	testErr := errors.New("db error")
	mockRepo := &mockReviewRepository{
		err: testErr,
	}
	svc := service.NewReviewService(mockRepo, nil)

	_, err := svc.GetQueue(context.Background(), 1, "due", entity.FirstReviewQueueCursor(), 10)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !errors.Is(err, testErr) {
		t.Errorf("expected error to wrap %v, got %v", testErr, err)
	}
}

func TestReviewService_RateReview_ReviewNotFound(t *testing.T) {
	mockRepo := &mockReviewRepository{
		err: repo.ErrReviewNotFound,
	}
	svc := service.NewReviewService(mockRepo, nil)

	_, err := svc.RateReview(context.Background(), 1, 1, "normal", time.Now())
	if !errors.Is(err, service.ErrReviewNotFound) {
		t.Errorf("expected ErrReviewNotFound, got %v", err)
	}
}

func TestReviewService_RateReview_InvalidRating(t *testing.T) {
	svc := service.NewReviewService(nil, nil)

	_, err := svc.RateReview(context.Background(), 1, 1, "invalid", time.Now())
	if !errors.Is(err, service.ErrInvalidRating) {
		t.Errorf("expected ErrInvalidRating, got %v", err)
	}
}

func TestReviewService_RateReview_Success(t *testing.T) {
	problemID := int64(1)
	mockRepo := &mockReviewRepository{
		schedule: entity.ReviewSchedule{
			ID:           1,
			UserID:       1,
			ProblemID:    &problemID,
			NextReviewAt: time.Now(),
			State:        0,
		},
	}
	svc := service.NewReviewService(mockRepo, nil)

	reviewedAt := time.Now().UTC()
	data, err := svc.RateReview(context.Background(), 1, 1, "normal", reviewedAt)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if data.ReviewID != 1 {
		t.Errorf("expected ReviewID 1, got %d", data.ReviewID)
	}
	if data.Rating != "normal" {
		t.Errorf("expected Rating 'normal', got %q", data.Rating)
	}
	if data.Status != "completed" {
		t.Errorf("expected Status 'completed', got %q", data.Status)
	}
}

func TestReviewService_GetStats_DelegatesToRepo(t *testing.T) {
	mockRepo := &mockReviewRepository{
		stats: entity.StatsData{
			TotalReviews: 10,
			NewCards:     2,
		},
	}
	svc := service.NewReviewService(mockRepo, nil)

	stats, err := svc.GetStats(context.Background(), 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if stats.TotalReviews != 10 {
		t.Errorf("expected TotalReviews 10, got %d", stats.TotalReviews)
	}
	if stats.NewCards != 2 {
		t.Errorf("expected NewCards 2, got %d", stats.NewCards)
	}
}

// mockReviewRepository реализует repo.ReviewRepository для тестов
type mockReviewRepository struct {
	items     []entity.ReviewItem
	schedule  entity.ReviewSchedule
	stats     entity.StatsData
	err       error
	called    bool
	gotCursor entity.ReviewQueueCursor
	gotLimit  int32
}

func (m *mockReviewRepository) QueueReviews(ctx context.Context, userID int64, status string, cursor entity.ReviewQueueCursor, limit int32) ([]entity.ReviewItem, error) {
	m.called = true
	m.gotCursor = cursor
	m.gotLimit = limit
	if m.err != nil {
		return nil, m.err
	}
	return m.items, nil
}

func (m *mockReviewRepository) ScheduleByID(ctx context.Context, scheduleID, userID int64) (entity.ReviewSchedule, error) {
	m.called = true
	if m.err != nil {
		return entity.ReviewSchedule{}, m.err
	}
	return m.schedule, nil
}

func (m *mockReviewRepository) SaveReview(ctx context.Context, schedule entity.ReviewSchedule, attempt entity.ReviewAttempt) (entity.ReviewSchedule, error) {
	m.called = true
	if m.err != nil {
		return entity.ReviewSchedule{}, m.err
	}
	return schedule, nil
}

func (m *mockReviewRepository) Stats(ctx context.Context, userID int64) (entity.StatsData, error) {
	m.called = true
	if m.err != nil {
		return entity.StatsData{}, m.err
	}
	return m.stats, nil
}

func (m *mockReviewRepository) UpdateProgressConfidence(ctx context.Context, userID, problemID int64, rating string) error {
	m.called = true
	return m.err
}

// Убеждаемся, что mock реализует интерфейс
var _ repo.ReviewRepository = (*mockReviewRepository)(nil)
