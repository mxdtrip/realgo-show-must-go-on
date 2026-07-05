package cards

import (
	"context"
	"testing"
	"time"

	reviewresponse "github.com/mxdtrip/freeburger/services/api/internal/controller/v1/response"
	"github.com/stretchr/testify/mock"
)

func TestWarmSeedCacheCachesNeetcodeCards(t *testing.T) {
	rdb := &mockRedis{}
	saved := make(map[string]seedCard)
	rdb.On("SaveJSON", mock.Anything, mock.AnythingOfType("string"), mock.Anything, time.Duration(0)).
		Run(func(args mock.Arguments) {
			key := args.Get(1).(string)
			card := args.Get(2).(seedCard)
			saved[key] = card
		}).
		Return(nil)

	if err := WarmSeedCache(context.Background(), rdb); err != nil {
		t.Fatalf("WarmSeedCache() error = %v", err)
	}

	const firstKey = "cards:seed:neetcode:neetcode-duplicate-integer-pattern-recognition"
	first, ok := saved[firstKey]
	if !ok {
		t.Fatalf("missing cached card %q", firstKey)
	}
	if first.Front == "" || first.Back == "" {
		t.Fatalf("cached card has empty body: %#v", first)
	}
	if len(saved) != 225 {
		t.Fatalf("cached cards = %d, want 225", len(saved))
	}
	rdb.AssertNumberOfCalls(t, "SaveJSON", 225)
}

type mockRepository struct {
	mock.Mock
}

var _ repository = (*mockRepository)(nil)

func (m *mockRepository) List(ctx context.Context, userID int64, params ListParams) ([]CardRecord, error) {
	args := m.Called(ctx, userID, params)
	records, _ := args.Get(0).([]CardRecord)
	return records, args.Error(1)
}

func (m *mockRepository) ListSession(ctx context.Context, userID int64, params SessionParams) ([]CardRecord, error) {
	args := m.Called(ctx, userID, params)
	records, _ := args.Get(0).([]CardRecord)
	return records, args.Error(1)
}

func (m *mockRepository) ListByProblem(ctx context.Context, userID, problemID int64) ([]CardRecord, error) {
	args := m.Called(ctx, userID, problemID)
	records, _ := args.Get(0).([]CardRecord)
	return records, args.Error(1)
}

func (m *mockRepository) EnsureReviewSchedule(ctx context.Context, userID, cardID int64, reviewedAt time.Time) (int64, error) {
	args := m.Called(ctx, userID, cardID, reviewedAt)
	return args.Get(0).(int64), args.Error(1)
}

func (m *mockRepository) CountSessionAttempts(ctx context.Context, userID int64, since time.Time) (int, error) {
	args := m.Called(ctx, userID, since)
	return args.Int(0), args.Error(1)
}

func (m *mockRepository) Create(ctx context.Context, userID int64, p CreateCardInput) (CardDetail, error) {
	args := m.Called(ctx, userID, p)
	card, _ := args.Get(0).(CardDetail)
	return card, args.Error(1)
}

func (m *mockRepository) GetByID(ctx context.Context, userID, cardID int64) (CardDetail, error) {
	args := m.Called(ctx, userID, cardID)
	card, _ := args.Get(0).(CardDetail)
	return card, args.Error(1)
}

func (m *mockRepository) Update(ctx context.Context, userID, cardID int64, p UpdateCardInput) (CardDetail, error) {
	args := m.Called(ctx, userID, cardID, p)
	card, _ := args.Get(0).(CardDetail)
	return card, args.Error(1)
}

func (m *mockRepository) Delete(ctx context.Context, userID, cardID int64) error {
	args := m.Called(ctx, userID, cardID)
	return args.Error(0)
}

type mockReviewRater struct {
	mock.Mock
}

var _ reviewRater = (*mockReviewRater)(nil)

func (m *mockReviewRater) RateReview(ctx context.Context, reviewID, userID int64, rating string, reviewedAt time.Time) (reviewresponse.RateReviewData, error) {
	args := m.Called(ctx, reviewID, userID, rating, reviewedAt)
	data, _ := args.Get(0).(reviewresponse.RateReviewData)
	return data, args.Error(1)
}

type mockRedis struct {
	mock.Mock
}

func (m *mockRedis) SaveJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
	args := m.Called(ctx, key, value, ttl)
	return args.Error(0)
}
