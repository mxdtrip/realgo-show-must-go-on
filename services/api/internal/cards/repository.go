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

func (r *pgRepository) EnsureReviewSchedule(ctx context.Context, userID, cardID int64, reviewedAt time.Time) (scheduleID int64, err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("cards: begin tx: %w", err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		if rollbackErr := tx.Rollback(ctx); rollbackErr != nil {
			err = errors.Join(err, fmt.Errorf("cards: rollback tx: %w", rollbackErr))
		}
	}()

	q := r.q.WithTx(tx)
	id, err := q.GetCardReviewSchedule(ctx, db.GetCardReviewScheduleParams{UserID: userID, CardID: toInt8(cardID)})
	switch {
	case err == nil:
		if err := tx.Commit(ctx); err != nil {
			return 0, fmt.Errorf("cards: commit tx: %w", err)
		}
		committed = true
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
		committed = true
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

func newCardRecord(id int64, cardType, front, back string, createdAt pgtype.Timestamptz, sourceEntityType string, sourceEntityID pgtype.Int8, sourceLabel string, scheduleID int64, nextReviewAt pgtype.Timestamptz, lastRating pgtype.Text, reviewCount, reviewState int32) CardRecord {
	return CardRecord{
		ID:               id,
		Type:             cardType,
		Front:            front,
		Back:             back,
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
		row.Question, // sqlc still returns DB column name "question" (rename in migration 000008)
		row.Answer,   // sqlc still returns DB column name "answer" (rename in migration 000008)
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
		row.Question, // sqlc still returns DB column name "question" (rename in migration 000008)
		row.Answer,   // sqlc still returns DB column name "answer" (rename in migration 000008)
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
		Question:    p.Front,
		Answer:      p.Back,
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
	if p.SourceText != nil {
		params.Source = pgtype.Text{String: *p.SourceText, Valid: true}
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
	if p.Front != nil {
		params.Question = pgtype.Text{String: *p.Front, Valid: true}
	}
	if p.Back != nil {
		params.Answer = pgtype.Text{String: *p.Back, Valid: true}
	}
	if p.Explanation != nil {
		params.Explanation = pgtype.Text{String: *p.Explanation, Valid: true}
	}
	if p.SourceText != nil {
		params.Source = pgtype.Text{String: *p.SourceText, Valid: true}
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

func newCardDetail(id int64, cardType, front, back string, createdByAI bool, createdAt pgtype.Timestamptz, explanation, source pgtype.Text, src Source) CardDetail {
	d := CardDetail{
		ID:          id,
		Type:        cardType,
		Front:       front,
		Back:        back,
		CreatedByAI: createdByAI,
		Source:      src,
	}
	if createdAt.Valid {
		d.CreatedAt = createdAt.Time.UTC()
	}
	d.Explanation = stringPtrFromPg(explanation)
	return d
}

func cardDetailFromGetRow(row db.GetCardByIDRow) CardDetail {
	src := buildSourceFromGetRow(row)
	return newCardDetail(row.ID, row.Type, row.Question, row.Answer, row.CreatedByAi.Bool, row.CreatedAt, row.Explanation, row.Source, src)
}

// buildSourceFromGetRow constructs the Source object from a GetCardByID row.
// The DB column is still "question" (rename planned in migration 000008).
func buildSourceFromGetRow(row db.GetCardByIDRow) Source {
	var entityType string
	var entityID *int64
	var label string

	if row.ProblemID.Valid {
		entityType = "problem"
		entityID = &row.ProblemID.Int64
		if row.ProblemTitle.Valid {
			label = row.ProblemTitle.String
		}
	} else if row.PatternID.Valid {
		entityType = "pattern"
		entityID = &row.PatternID.Int64
		if row.PatternName.Valid {
			label = row.PatternName.String
		}
	} else {
		entityType = "custom"
		if row.Source.Valid {
			label = row.Source.String
		}
	}

	return Source{
		EntityType: entityType,
		EntityID:   entityID,
		Label:      label,
	}
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
