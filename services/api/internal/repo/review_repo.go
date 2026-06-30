package repo

import (
	"context"

	"github.com/mxdtrip/freeburger/services/api/internal/entity"
)

// ReviewRepository — интерфейс для работы с данными повторений.
type ReviewRepository interface {
	// TodayReviews возвращает повторения на сегодня.
	TodayReviews(ctx context.Context, userID int64, limit int32) ([]entity.ReviewItem, error)

	// ScheduleByID возвращает расписание по ID.
	ScheduleByID(ctx context.Context, scheduleID, userID int64) (entity.ReviewSchedule, error)

	// SaveReview сохраняет результат повторения.
	SaveReview(ctx context.Context, schedule entity.ReviewSchedule, attempt entity.ReviewAttempt) (entity.ReviewSchedule, error)

	// Stats возвращает статистику повторений.
	Stats(ctx context.Context, userID int64) (entity.StatsData, error)
}
