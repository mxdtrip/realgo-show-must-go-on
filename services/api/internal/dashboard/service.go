package dashboard

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/mxdtrip/freeburger/services/api/internal/patterns"
)

const (
	reviewPreviewLimit = 5
	weakPatternsLimit  = 5
	// activityWindowDays matches the dashboard heatmap: 4 rows × 14 columns.
	activityWindowDays = 56
)

type repository interface {
	GetMetrics(ctx context.Context, userID int64) (Metrics, error)
	ListActivity(ctx context.Context, userID int64, days int32) ([]ActivityDay, error)
	ListReviewPreview(ctx context.Context, userID int64, limit int32) ([]ReviewPreview, error)
	GetNextReview(ctx context.Context, userID int64) (*ReviewPreview, error)
}

type weakPatternRepository interface {
	ListWeak(ctx context.Context, userID int64, limit int32) ([]patterns.WeakPattern, error)
}

type Service struct {
	repo     repository
	weakRepo weakPatternRepository
}

func NewService(repo repository, weakRepo weakPatternRepository) *Service {
	return &Service{repo: repo, weakRepo: weakRepo}
}

func (s *Service) Get(ctx context.Context, userID int64) (Response, error) {
	metrics, err := s.repo.GetMetrics(ctx, userID)
	if err != nil {
		return Response{}, fmt.Errorf("dashboard: get metrics: %w", err)
	}

	reviews, err := s.repo.ListReviewPreview(ctx, userID, reviewPreviewLimit)
	if err != nil {
		return Response{}, fmt.Errorf("dashboard: list review preview: %w", err)
	}

	nextReview, err := s.repo.GetNextReview(ctx, userID)
	if err != nil {
		return Response{}, fmt.Errorf("dashboard: get next review: %w", err)
	}

	activityDays, err := s.repo.ListActivity(ctx, userID, activityWindowDays)
	if err != nil {
		return Response{}, fmt.Errorf("dashboard: list activity: %w", err)
	}

	weakPatterns := make([]patterns.WeakPattern, 0)
	if s.weakRepo != nil {
		weakPatterns, err = s.weakRepo.ListWeak(ctx, userID, weakPatternsLimit)
		if err != nil {
			return Response{}, fmt.Errorf("dashboard: list weak patterns: %w", err)
		}
	}

	reviewPreview := mapReviewPreview(reviews)
	return Response{
		NextAction:    buildNextAction(metrics, reviewPreview, mapOptionalReview(nextReview)),
		Stats:         buildStats(metrics),
		ReviewPreview: reviewPreview,
		WeakPatterns:  mapWeakPatterns(weakPatterns),
		Activity:      buildActivity(activityDays),
	}, nil
}

func buildActivity(days []ActivityDay) Activity {
	total := 0
	for _, day := range days {
		total += day.Count
	}
	if days == nil {
		days = []ActivityDay{}
	}
	return Activity{
		Days:         days,
		ActiveDays:   len(days),
		TotalReviews: total,
	}
}

func buildStats(metrics Metrics) []Stat {
	readiness := clamp(metrics.Readiness, 0, 100)
	return []Stat{
		{
			Key:          "today_queue",
			Label:        "today queue",
			Value:        metrics.DueCount,
			DisplayValue: strconv.Itoa(metrics.DueCount),
			Hint:         fmt.Sprintf("%d задач, %d карточек, %d паттернов", metrics.DueProblemCount, metrics.DueCardCount, metrics.DuePatternCount),
			Tone:         toneWhen(metrics.DueCount > 0, statToneAccent, statToneDefault),
		},
		{
			Key:          "solved_total",
			Label:        "solved",
			Value:        metrics.SolvedCount,
			DisplayValue: strconv.Itoa(metrics.SolvedCount),
			Hint:         "решено задач всего",
			Tone:         statToneDefault,
		},
		{
			Key:          "streak",
			Label:        "streak",
			Value:        metrics.CurrentStreak,
			DisplayValue: strconv.Itoa(metrics.CurrentStreak),
			Hint:         "дней подряд активности",
			Tone:         toneWhen(metrics.CurrentStreak > 0, statToneAccent, statToneDefault),
		},
		{
			Key:          "readiness",
			Label:        "readiness",
			Value:        readiness,
			DisplayValue: fmt.Sprintf("%d%%", readiness),
			Hint:         readinessHint(metrics.ProgressCount),
			Tone:         readinessTone(readiness, metrics.ProgressCount),
		},
	}
}

func buildNextAction(metrics Metrics, dueItems []ReviewPreviewItem, nextReview *ReviewPreviewItem) NextAction {
	if metrics.DueCount > 0 && len(dueItems) > 0 {
		first := dueItems[0]
		dueAt := first.DueAt
		return NextAction{
			Type:        actionType(first.Type),
			Title:       fmt.Sprintf("%d повторений на сегодня", metrics.DueCount),
			Description: nonEmpty(first.Meta, first.Title),
			Href:        actionHref(first.Type),
			DueAt:       &dueAt,
		}
	}
	if nextReview == nil {
		return NextAction{
			Type:        nextActionTypeRoadmapStep,
			Title:       "Начните с первой задачи",
			Description: "NeetCode 150",
			Href:        "/roadmap",
		}
	}
	dueAt := nextReview.DueAt
	return NextAction{
		Type:        actionType(nextReview.Type),
		Title:       "Следующее повторение",
		Description: nonEmpty(nextReview.Meta, nextReview.Title),
		Href:        actionHref(nextReview.Type),
		DueAt:       &dueAt,
	}
}

func mapReviewPreview(items []ReviewPreview) []ReviewPreviewItem {
	mapped := make([]ReviewPreviewItem, 0, len(items))
	for _, item := range items {
		mapped = append(mapped, mapReview(item))
	}
	return mapped
}

func mapOptionalReview(item *ReviewPreview) *ReviewPreviewItem {
	if item == nil {
		return nil
	}
	mapped := mapReview(*item)
	return &mapped
}

func mapReview(item ReviewPreview) ReviewPreviewItem {
	return ReviewPreviewItem{
		ID:         strconv.FormatInt(item.ID, 10),
		Type:       reviewType(item.EntityType),
		Title:      nonEmpty(item.Title, "Review"),
		Meta:       reviewMeta(item.PatternName, item.Difficulty),
		DueAt:      item.DueAt,
		LastRating: item.LastRating,
	}
}

func mapWeakPatterns(items []patterns.WeakPattern) []WeakPattern {
	mapped := make([]WeakPattern, 0, len(items))
	for _, item := range items {
		mapped = append(mapped, WeakPattern{
			ID:         patternID(item.PatternCode),
			Name:       item.Pattern,
			Confidence: weakPatternConfidence(item.HardCount),
			Signal:     fmt.Sprintf("%d hard из %d повторений", item.HardCount, item.ReviewCount),
		})
	}
	return mapped
}

func reviewType(entityType string) string {
	switch entityType {
	case "card":
		return reviewPreviewTypeCard
	case "pattern":
		return reviewPreviewTypePattern
	default:
		return reviewPreviewTypeProblem
	}
}

func actionType(reviewType string) string {
	switch reviewType {
	case reviewPreviewTypeCard:
		return nextActionTypeCardSession
	case reviewPreviewTypePattern:
		return nextActionTypePatternReview
	default:
		return nextActionTypeProblemReview
	}
}

func actionHref(reviewType string) string {
	if reviewType == reviewPreviewTypeCard {
		return "/cards/session"
	}
	return "/reviews"
}

func reviewMeta(patternName, difficulty string) string {
	parts := make([]string, 0, 2)
	if strings.TrimSpace(patternName) != "" {
		parts = append(parts, strings.TrimSpace(patternName))
	}
	if strings.TrimSpace(difficulty) != "" {
		parts = append(parts, strings.TrimSpace(difficulty))
	}
	return strings.Join(parts, " · ")
}

func patternID(code string) string {
	code = strings.TrimSpace(code)
	if strings.HasPrefix(code, "pat_") {
		return code
	}
	return "pat_" + code
}

func weakPatternConfidence(hardCount int) int {
	return clamp(100-hardCount*20, 0, 100)
}

func readinessHint(progressCount int) string {
	if progressCount == 0 {
		return "нет данных по прогрессу"
	}
	return "готовность к интервью"
}

func readinessTone(readiness, progressCount int) string {
	if progressCount == 0 {
		return statToneDefault
	}
	if readiness >= 70 {
		return statToneSuccess
	}
	if readiness >= 40 {
		return statToneWarning
	}
	return statToneDanger
}

func toneWhen(condition bool, trueTone, falseTone string) string {
	if condition {
		return trueTone
	}
	return falseTone
}

func nonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func clamp(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}
