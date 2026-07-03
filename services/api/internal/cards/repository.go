package cards

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

type pgRepository struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewRepository(pool *pgxpool.Pool) *pgRepository {
	return &pgRepository{pool: pool, q: db.New(pool)}
}

func (r *pgRepository) List(ctx context.Context, userID int64, params ListParams) ([]CardRecord, error) {
	rows, err := r.q.ListUserCards(ctx, db.ListUserCardsParams{
		UserID:          userID,
		CardType:        params.Type,
		CursorCreatedAt: toTimestamptz(params.Cursor.CreatedAt),
		CursorID:        params.Cursor.ID,
		LimitRows:       params.Limit,
	})
	if err != nil {
		return nil, fmt.Errorf("cards: list user cards: %w", err)
	}

	items := make([]CardRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, recordFromListRow(row))
	}
	return items, nil
}

func (r *pgRepository) ListSession(ctx context.Context, userID int64, params SessionParams) ([]CardRecord, error) {
	rows, err := r.q.ListCardSession(ctx, db.ListCardSessionParams{
		UserID:    userID,
		Scope:     params.Scope,
		CardLimit: params.Limit,
	})
	if err != nil {
		return nil, fmt.Errorf("cards: list session: %w", err)
	}

	items := make([]CardRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, recordFromSessionRow(row))
	}
	return items, nil
}

func (r *pgRepository) EnsureReviewSchedule(ctx context.Context, userID, cardID int64, reviewedAt time.Time) (int64, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("cards: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	q := r.q.WithTx(tx)
	id, err := q.GetCardReviewSchedule(ctx, db.GetCardReviewScheduleParams{UserID: userID, CardID: toInt8(cardID)})
	switch {
	case err == nil:
		if err := tx.Commit(ctx); err != nil {
			return 0, fmt.Errorf("cards: commit tx: %w", err)
		}
		return id, nil
	case errors.Is(err, pgx.ErrNoRows):
		if _, err := q.GetAccessibleCard(ctx, db.GetAccessibleCardParams{CardID: cardID, UserID: userID}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return 0, ErrCardNotFound
			}
			return 0, fmt.Errorf("cards: lookup card: %w", err)
		}
		createdID, err := q.CreateCardReviewSchedule(ctx, db.CreateCardReviewScheduleParams{
			UserID:       userID,
			CardID:       toInt8(cardID),
			NextReviewAt: toTimestamptz(reviewedAt),
		})
		if err != nil {
			return 0, fmt.Errorf("cards: create schedule: %w", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return 0, fmt.Errorf("cards: commit tx: %w", err)
		}
		return createdID, nil
	default:
		return 0, fmt.Errorf("cards: lookup schedule: %w", err)
	}
}

func (r *pgRepository) CountSessionAttempts(ctx context.Context, userID int64, since time.Time) (int, error) {
	count, err := r.q.CountCardSessionAttempts(ctx, db.CountCardSessionAttemptsParams{
		UserID:    userID,
		CreatedAt: toTimestamptz(since),
	})
	if err != nil {
		return 0, fmt.Errorf("cards: count session attempts: %w", err)
	}
	return int(count), nil
}

func newCardRecord(id int64, cardType, question, answer string, createdAt pgtype.Timestamptz, sourceEntityType string, sourceEntityID pgtype.Int8, sourceLabel string, scheduleID int64, nextReviewAt pgtype.Timestamptz, lastRating pgtype.Text, reviewCount, reviewState int32) CardRecord {
	return CardRecord{
		ID:               id,
		Type:             cardType,
		Question:         question,
		Answer:           answer,
		CreatedAt:        timeFromPg(createdAt),
		SourceEntityType: sourceEntityType,
		SourceEntityID:   int64PtrFromPg(sourceEntityID),
		SourceLabel:      sourceLabel,
		ScheduleID:       scheduleIDPtr(scheduleID),
		NextReviewAt:     timePtrFromPg(nextReviewAt),
		LastRating:       stringPtrFromPg(lastRating),
		ReviewCount:      int(reviewCount),
		ReviewState:      int(reviewState),
	}
}

func recordFromListRow(row db.ListUserCardsRow) CardRecord {
	return newCardRecord(
		row.ID,
		row.Type,
		row.Question,
		row.Answer,
		row.CreatedAt,
		row.SourceEntityType,
		row.SourceEntityID,
		row.SourceLabel,
		row.ScheduleID,
		row.NextReviewAt,
		row.LastRating,
		row.ReviewCount,
		row.ReviewState,
	)
}

func recordFromSessionRow(row db.ListCardSessionRow) CardRecord {
	return newCardRecord(
		row.ID,
		row.Type,
		row.Question,
		row.Answer,
		row.CreatedAt,
		row.SourceEntityType,
		row.SourceEntityID,
		row.SourceLabel,
		row.ScheduleID,
		row.NextReviewAt,
		row.LastRating,
		row.ReviewCount,
		row.ReviewState,
	)
}

func (r *pgRepository) Create(ctx context.Context, userID int64, p CreateCardInput) (CardDetail, error) {
	params := db.CreateCardParams{
		UserID:      userID,
		CardType:    p.Type,
		Question:    p.Question,
		Answer:      p.Answer,
		CreatedByAi: pgtype.Bool{Bool: false, Valid: true},
	}
	if p.ProblemID != nil {
		params.ProblemID = pgtype.Int8{Int64: *p.ProblemID, Valid: true}
	}
	if p.PatternID != nil {
		params.PatternID = pgtype.Int8{Int64: *p.PatternID, Valid: true}
	}
	if p.Explanation != nil {
		params.Explanation = pgtype.Text{String: *p.Explanation, Valid: true}
	}
	if p.Source != nil {
		params.Source = pgtype.Text{String: *p.Source, Valid: true}
	}
	card, err := r.q.CreateCard(ctx, params)
	if err != nil {
		if isForeignKeyViolation(err) {
			return CardDetail{}, ErrCardTargetNotFound
		}
		return CardDetail{}, fmt.Errorf("cards: create: %w", err)
	}
	return r.GetByID(ctx, userID, card.ID)
}

func (r *pgRepository) GetByID(ctx context.Context, userID, cardID int64) (CardDetail, error) {
	row, err := r.q.GetCardByID(ctx, db.GetCardByIDParams{CardID: cardID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return CardDetail{}, ErrCardNotFound
	}
	if err != nil {
		return CardDetail{}, fmt.Errorf("cards: get by id: %w", err)
	}
	return cardDetailFromGetRow(row), nil
}

func (r *pgRepository) Update(ctx context.Context, userID, cardID int64, p UpdateCardInput) (CardDetail, error) {
	params := db.UpdateCardParams{CardID: cardID, UserID: userID}
	if p.Type != nil {
		params.CardType = pgtype.Text{String: *p.Type, Valid: true}
	}
	if p.Question != nil {
		params.Question = pgtype.Text{String: *p.Question, Valid: true}
	}
	if p.Answer != nil {
		params.Answer = pgtype.Text{String: *p.Answer, Valid: true}
	}
	if p.Explanation != nil {
		params.Explanation = pgtype.Text{String: *p.Explanation, Valid: true}
	}
	if p.Source != nil {
		params.Source = pgtype.Text{String: *p.Source, Valid: true}
	}
	card, err := r.q.UpdateCard(ctx, params)
	if errors.Is(err, pgx.ErrNoRows) {
		return CardDetail{}, ErrCardNotFound
	}
	if err != nil {
		return CardDetail{}, fmt.Errorf("cards: update: %w", err)
	}
	return r.GetByID(ctx, userID, card.ID)
}

func (r *pgRepository) Delete(ctx context.Context, userID, cardID int64) error {
	rows, err := r.q.DeleteCard(ctx, db.DeleteCardParams{CardID: cardID, UserID: userID})
	if err != nil {
		return fmt.Errorf("cards: delete: %w", err)
	}
	if rows == 0 {
		return ErrCardNotFound
	}
	return nil
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

func newCardDetail(id int64, cardType, question, answer string, createdByAI bool, createdAt pgtype.Timestamptz, explanation, source pgtype.Text) CardDetail {
	d := CardDetail{
		ID:          id,
		Type:        cardType,
		Question:    question,
		Answer:      answer,
		CreatedByAI: createdByAI,
	}
	if createdAt.Valid {
		d.CreatedAt = createdAt.Time.UTC()
	}
	d.Explanation = stringPtrFromPg(explanation)
	d.Source = stringPtrFromPg(source)
	return d
}

func cardDetailFromCard(c db.Card, problemTitle, problemURL, patternName pgtype.Text) CardDetail {
	d := newCardDetail(c.ID, c.Type, c.Question, c.Answer, c.CreatedByAi.Bool, c.CreatedAt, c.Explanation, c.Source)
	d.ProblemTitle = stringPtrFromPg(problemTitle)
	d.ProblemURL = stringPtrFromPg(problemURL)
	d.PatternName = stringPtrFromPg(patternName)
	return d
}

func cardDetailFromGetRow(row db.GetCardByIDRow) CardDetail {
	d := newCardDetail(row.ID, row.Type, row.Question, row.Answer, row.CreatedByAi.Bool, row.CreatedAt, row.Explanation, row.Source)
	d.ProblemTitle = stringPtrFromPg(row.ProblemTitle)
	d.ProblemURL = stringPtrFromPg(row.ProblemUrl)
	d.PatternName = stringPtrFromPg(row.PatternName)
	return d
}

func int64PtrFromPg(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}

func scheduleIDPtr(value int64) *int64 {
	if value == 0 {
		return nil
	}
	return &value
}

func stringPtrFromPg(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func timePtrFromPg(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	v := value.Time.UTC()
	return &v
}

func timeFromPg(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Unix(0, 0).UTC()
	}
	return value.Time.UTC()
}

func toInt8(value int64) pgtype.Int8 {
	return pgtype.Int8{Int64: value, Valid: true}
}

func toTimestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value.UTC(), Valid: true}
}
