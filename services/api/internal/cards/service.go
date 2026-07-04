package cards

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	reviewresponse "github.com/mxdtrip/freeburger/services/api/internal/controller/v1/response"
	reviewservice "github.com/mxdtrip/freeburger/services/api/internal/service"
)

var (
	ErrCardNotFound       = errors.New("card not found")
	ErrCardTargetNotFound = errors.New("card target not found")
	ErrInvalidRating      = errors.New("rating must be hard, normal, or easy")
)

type repository interface {
	List(ctx context.Context, userID int64, params ListParams) ([]CardRecord, error)
	ListSession(ctx context.Context, userID int64, params SessionParams) ([]CardRecord, error)
	EnsureReviewSchedule(ctx context.Context, userID, cardID int64, reviewedAt time.Time) (int64, error)
	CountSessionAttempts(ctx context.Context, userID int64, since time.Time) (int, error)
	Create(ctx context.Context, userID int64, p CreateCardInput) (CardDetail, error)
	GetByID(ctx context.Context, userID, cardID int64) (CardDetail, error)
	Update(ctx context.Context, userID, cardID int64, p UpdateCardInput) (CardDetail, error)
	Delete(ctx context.Context, userID, cardID int64) error
}

type reviewRater interface {
	RateReview(ctx context.Context, reviewID, userID int64, rating string, reviewedAt time.Time) (reviewresponse.RateReviewData, error)
}

type Service struct {
	repo  repository
	rater reviewRater
	now   func() time.Time
}

func NewService(repo repository, rater reviewRater) *Service {
	return &Service{repo: repo, rater: rater, now: func() time.Time { return time.Now().UTC() }}
}

func (s *Service) List(ctx context.Context, userID int64, params ListParams) ([]Card, *string, error) {
	records, err := s.repo.List(ctx, userID, params)
	if err != nil {
		return nil, nil, fmt.Errorf("cards: list: %w", err)
	}

	var nextCursor *string
	if len(records) > params.PageSize {
		records = records[:params.PageSize]
		last := records[len(records)-1]
		cursor := encodeCursor(Cursor{CreatedAt: last.CreatedAt, ID: last.ID})
		nextCursor = &cursor
	}

	items := make([]Card, 0, len(records))
	now := s.now()
	for _, record := range records {
		items = append(items, cardFromRecord(record, now))
	}
	return items, nextCursor, nil
}

func (s *Service) Session(ctx context.Context, userID int64, params SessionParams) (Session, error) {
	records, err := s.repo.ListSession(ctx, userID, params)
	if err != nil {
		return Session{}, fmt.Errorf("cards: session: %w", err)
	}

	cards := make([]SessionCard, 0, len(records))
	for _, record := range records {
		cards = append(cards, sessionCardFromRecord(record))
	}

	return Session{
		SessionID:        encodeSessionID(sessionToken{Scope: params.Scope, Total: len(cards), StartedAt: s.now()}),
		Scope:            params.Scope,
		EstimatedMinutes: estimatedMinutes(len(cards)),
		Cards:            cards,
	}, nil
}

func (s *Service) Rate(ctx context.Context, userID, cardID int64, req RateRequest) (RateResult, error) {
	if !validRating(req.Rating) {
		return RateResult{}, ErrInvalidRating
	}

	reviewedAt, err := time.Parse(time.RFC3339, req.ReviewedAt)
	if err != nil {
		return RateResult{}, fmt.Errorf("invalid reviewedAt format, expected ISO 8601")
	}
	reviewedAt = reviewedAt.UTC()

	reviewID, err := s.repo.EnsureReviewSchedule(ctx, userID, cardID, reviewedAt)
	if err != nil {
		if errors.Is(err, ErrCardNotFound) {
			return RateResult{}, ErrCardNotFound
		}
		return RateResult{}, fmt.Errorf("cards: ensure review schedule: %w", err)
	}

	rated, err := s.rater.RateReview(ctx, reviewID, userID, req.Rating, reviewedAt)
	if err != nil {
		if errors.Is(err, reviewservice.ErrReviewNotFound) {
			return RateResult{}, ErrCardNotFound
		}
		return RateResult{}, fmt.Errorf("cards: rate review: %w", err)
	}

	token := decodeSessionID(req.SessionID)
	reviewed := 1
	if !token.StartedAt.IsZero() {
		if count, countErr := s.repo.CountSessionAttempts(ctx, userID, token.StartedAt); countErr == nil && count > 0 {
			reviewed = count
		}
	}
	total := token.Total
	if total < reviewed {
		total = reviewed
	}
	if total == 0 {
		total = reviewed
	}

	repeat := req.Rating == "hard"
	remaining := total - reviewed
	if remaining < 0 {
		remaining = 0
	}
	if repeat {
		remaining++
	}

	return RateResult{
		CardID:                 cardID,
		Rating:                 req.Rating,
		NextReviewAt:           rated.NextReviewAt,
		RepeatInCurrentSession: repeat,
		SessionProgress: SessionProgress{
			Reviewed:  reviewed,
			Total:     total,
			Remaining: remaining,
		},
	}, nil
}

func cardFromRecord(record CardRecord, now time.Time) Card {
	return Card{
		ID:   record.ID,
		Type: record.Type,
		Source: Source{
			EntityType: record.SourceEntityType,
			EntityID:   record.SourceEntityID,
			Label:      record.SourceLabel,
		},
		Front:        record.Front,
		Back:         record.Back,
		Status:       status(record, now),
		NextReviewAt: record.NextReviewAt,
		LastRating:   record.LastRating,
		CreatedAt:    record.CreatedAt,
	}
}

func sessionCardFromRecord(record CardRecord) SessionCard {
	return SessionCard{
		ID:          record.ID,
		Type:        record.Type,
		SourceLabel: record.SourceLabel,
		Front:       record.Front,
		Back:        record.Back,
		ReviewState: ReviewState{
			Attempts:     record.ReviewCount,
			LastRating:   record.LastRating,
			NextReviewAt: record.NextReviewAt,
		},
	}
}

func status(record CardRecord, now time.Time) string {
	if record.ScheduleID == nil {
		return CardStatusNew
	}
	if record.NextReviewAt != nil && !record.NextReviewAt.After(now) {
		return CardStatusDue
	}
	switch record.ReviewState {
	case 1, 3:
		return CardStatusLearning
	case 2:
		return CardStatusMastered
	default:
		return CardStatusNew
	}
}

func estimatedMinutes(count int) int {
	if count == 0 {
		return 0
	}
	return int(math.Ceil(float64(count) * 0.75))
}

func validRating(rating string) bool {
	switch rating {
	case "hard", "normal", "easy":
		return true
	default:
		return false
	}
}

type sessionToken struct {
	Scope     string    `json:"scope"`
	Total     int       `json:"total"`
	StartedAt time.Time `json:"startedAt"`
}

func encodeSessionID(token sessionToken) string {
	raw, err := json.Marshal(token)
	if err != nil {
		return "crs"
	}
	return "crs_" + base64.RawURLEncoding.EncodeToString(raw)
}

func decodeSessionID(value string) sessionToken {
	raw := strings.TrimPrefix(strings.TrimSpace(value), "crs_")
	if raw == "" {
		return sessionToken{}
	}
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return sessionToken{}
	}
	var token sessionToken
	if err := json.Unmarshal(decoded, &token); err != nil {
		return sessionToken{}
	}
	return token
}

func (s *Service) Create(ctx context.Context, userID int64, p CreateCardInput) (CardDetail, error) {
	card, err := s.repo.Create(ctx, userID, p)
	if err != nil {
		return CardDetail{}, fmt.Errorf("cards: create: %w", err)
	}
	return card, nil
}

func (s *Service) GetByID(ctx context.Context, userID, cardID int64) (CardDetail, error) {
	card, err := s.repo.GetByID(ctx, userID, cardID)
	if err != nil {
		return CardDetail{}, fmt.Errorf("cards: get by id: %w", err)
	}
	return card, nil
}

func (s *Service) Update(ctx context.Context, userID, cardID int64, p UpdateCardInput) (CardDetail, error) {
	card, err := s.repo.Update(ctx, userID, cardID, p)
	if err != nil {
		return CardDetail{}, fmt.Errorf("cards: update: %w", err)
	}
	return card, nil
}

func (s *Service) Delete(ctx context.Context, userID, cardID int64) error {
	return s.repo.Delete(ctx, userID, cardID)
}
