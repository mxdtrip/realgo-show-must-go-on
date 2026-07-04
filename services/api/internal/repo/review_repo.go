package repo

import (
	"context"

	"github.com/mxdtrip/freeburger/services/api/internal/entity"
)

// ReviewRepository — интерфейс для работы с данными повторений.
type ReviewRepository interface {
	// QueueReviews возвращает элементы очереди с фильтром due/upcoming,
	// постранично начиная сразу после cursor.
	QueueReviews(ctx context.Context, userID int64, status string, cursor entity.ReviewQueueCursor, limit int32) ([]entity.ReviewItem, error)

	// ScheduleByID возвращает расписание по ID.
	ScheduleByID(ctx context.Context, scheduleID, userID int64) (entity.ReviewSchedule, error)

	// SaveReview сохраняет результат повторения.
	SaveReview(ctx context.Context, schedule entity.ReviewSchedule, attempt entity.ReviewAttempt) (entity.ReviewSchedule, error)

	// Stats возвращает статистику повторений.
	Stats(ctx context.Context, userID int64) (entity.StatsData, error)

	// UpdateProgressConfidence обновляет confidence по задаче.
	UpdateProgressConfidence(ctx context.Context, userID, problemID int64, rating string) error
}
