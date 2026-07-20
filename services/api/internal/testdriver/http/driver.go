// Package http — драйвер acceptance-тестов: единственное место, которое знает
// о существовании HTTP. Он поднимает настоящий сервер внутри процесса,
// взаимодействует с ним через реальный сокет (httptest.Server) и предоставляет
// спецификациям объект предметной области, через который они могут управлять
// системой. Благодаря этому спецификации остаются независимыми от транспорта
// и действительно работают как black-box тесты. Аутентификация проходит через
// реальный сценарий POST /auth/register → Bearer, без каких-либо обходных путей.
//
// Seed-операции (QuizSeeder) и probe (ConfidenceProbe) обращаются к БД напрямую:
// это сознательное test-only исключение для посева данных, которые пока нельзя
// создать через HTTP (AI-генерация викторины отложена), и для чтения состояния,
// не имеющего API read-path (confidence).
package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/scheduler"
	"github.com/mxdtrip/freeburger/services/api/internal/server"
	"github.com/mxdtrip/freeburger/services/api/internal/specifications"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/redis"
	"github.com/mxdtrip/freeburger/services/api/internal/testutil"
)

// Driver реализует HTTP-провайдеры спецификаций поверх реального сервера.
var (
	_ specifications.HarnessProvider = (*Driver)(nil)
	_ specifications.CardsProvider   = (*Driver)(nil)
	_ specifications.QuizProvider    = (*Driver)(nil)
	_ specifications.QuizSeeder      = (*Driver)(nil)
	_ specifications.QuizProbe       = (*Driver)(nil)
	_ specifications.FSRSProvider    = (*Driver)(nil)
	_ specifications.FSRSStateProbe  = (*Driver)(nil)
)

const testJWTSecret = "acceptance-test-jwt-secret-32-bytes"

type Driver struct {
	t      *testing.T
	srv    *httptest.Server
	client *http.Client
	pg     *postgres.Storage
}

// Option configures the driver's server.Deps beyond the test harness defaults.
// Options are applied left-to-right; later options win.
type Option func(*driverConfig)

type driverConfig struct {
	scheduler scheduler.Scheduler
}

// WithFSRS injects a scheduler built from the given FSRS config, so the
// FSRSRetentionAffectsIntervals spec can spin up two drivers with different
// request_retention and observe different intervals. When omitted, the driver
// falls back to scheduler.NewFSRSAdapter() (default parameters).
func WithFSRS(cfg scheduler.Config) Option {
	return func(c *driverConfig) {
		c.scheduler = scheduler.NewFromConfig(cfg)
	}
}

func New(t *testing.T, h *testutil.Harness, opts ...Option) *Driver {
	t.Helper()
	ctx := context.Background()

	cfg := driverConfig{}
	for _, opt := range opts {
		opt(&cfg)
	}

	dbCfg := h.DatabaseConfig()
	pg, err := postgres.New(ctx, &dbCfg)
	if err != nil {
		t.Fatalf("driver: connect postgres: %v", err)
	}
	t.Cleanup(pg.Close)

	rdCfg := h.RedisConfig()
	rd, err := redis.New(ctx, &rdCfg)
	if err != nil {
		t.Fatalf("driver: connect redis: %v", err)
	}
	t.Cleanup(func() {
		if err := rd.Close(); err != nil {
			t.Fatalf("driver: close redis: %v", err)
		}
	})

	authSvc := auth.NewService(db.New(pg.Pool), rd.Client, auth.Config{
		JWTSecret:  []byte(testJWTSecret),
		AccessTTL:  15 * time.Minute,
		RefreshTTL: 30 * 24 * time.Hour,
		Issuer:     "freeburger",
	})

	deps := server.Deps{
		Logger:   slog.Default(),
		Postgres: pg,
		Redis:    rd,
		Auth:     authSvc,
	}
	if cfg.scheduler != nil {
		deps.Scheduler = cfg.scheduler
	}

	handler := server.New(deps)

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	return &Driver{t: t, srv: srv, client: srv.Client(), pg: pg}
}

func (d *Driver) Close() { d.srv.Close() }

// --- FSRSProvider / FSRSUser ---

// FSRSUser wraps an authenticated user and adds the FSRS-touching client
// operations the spec exercises: extension-event solve, card first-rate,
// unrated-card creation, repeated rate, session listing.
func (d *Driver) FSRSUser(user specifications.AuthenticatedUser) specifications.FSRSUser {
	t := d.t
	return &fsrsUser{driver: d, user: user, t: t}
}

type fsrsUser struct {
	driver *Driver
	user   specifications.AuthenticatedUser
	t      *testing.T

	// lastCardID remembers the card created/rated by the most recent
	// CreateUnratedCard or RateFirstReview call, so LastRatedCardID can return
	// it without exposing card_id through the HTTP response.
	lastCardID int64
}

func (u *fsrsUser) OwnIdentity(t *testing.T) string { return u.user.OwnIdentity(t) }
func (u *fsrsUser) UserID(t *testing.T) int64       { return u.user.UserID(t) }

// SubmitExtensionSolved posts a "problem solved" extension event and returns
// nextReviewAt from the server's response. The rating is the user's perceived
// difficulty (hard/normal/easy), which the extension maps into an FSRS grade.
func (u *fsrsUser) SubmitExtensionSolved(t *testing.T, title, url, slug, rating string) time.Time {
	t.Helper()
	body := map[string]any{
		"eventId":          fmt.Sprintf("evt-%s-%d", slug, time.Now().UnixNano()),
		"source":           "leetcode",
		"event":            "problem_solved",
		"occurredAt":       time.Now().UTC().Format(time.RFC3339),
		"rating":           rating,
		"extensionVersion": "0.0.1-acceptance",
		"problem": map[string]any{
			"externalId": slug,
			"title":      title,
			"url":        url,
		},
	}
	resp := u.driver.do(t, http.MethodPost, "/api/v1/extension/events", body, u.token())

	var out struct {
		Data struct {
			NextReviewAt time.Time `json:"nextReviewAt"`
		} `json:"data"`
	}
	u.driver.decode(t, resp, &out)
	if out.Data.NextReviewAt.IsZero() {
		t.Fatalf("driver: extension solve: empty nextReviewAt in response")
	}
	return out.Data.NextReviewAt
}

// RateFirstReview creates a card and rates it once with the given rating,
// returning nextReviewAt from the server's response. The card is created
// fresh so this is its first FSRS rating.
func (u *fsrsUser) RateFirstReview(t *testing.T, front, back, rating string) time.Time {
	t.Helper()
	cu := u.driver.CardsUser(u.user)

	card := cu.CreateCard(t, front, back, "pattern_recognition")
	u.lastCardID = card.ID

	// "all" scope catches a brand-new card (no schedule yet).
	session := cu.StartSession(t, "all")

	info := cu.RateCard(t, session.SessionID, card.ID, rating)

	// RateCard returns session progress, not nextReviewAt. Re-read the
	// schedule from the DB through the existing FSRS probe path so we get the
	// same field the extension path exposes. This is the same test-only read
	// exception used by QuizProbe: there is no HTTP read path for
	// next_review_at on cards.
	return u.readCardNextReviewAt(t, card.ID, info)
}

// CreateUnratedCard creates a card via POST /me/cards without rating it. The
// spec B1 then checks the schedule row written (if any) carries the canonical
// fsrs.NewCard() state rather than hardcoded placeholder values.
func (u *fsrsUser) CreateUnratedCard(t *testing.T, front, back, cardType string) int64 {
	t.Helper()
	cu := u.driver.CardsUser(u.user)
	card := cu.CreateCard(t, front, back, cardType)
	u.lastCardID = card.ID
	return card.ID
}

// StartSessionAll starts a card session with scope="all" (includes unrated
// cards) and returns the sessionId. Used by the spec to trigger any lazy
// schedule creation as a side effect of listing.
func (u *fsrsUser) StartSessionAll(t *testing.T) string {
	t.Helper()
	cu := u.driver.CardsUser(u.user)
	session := cu.StartSession(t, "all")
	return session.SessionID
}

// RateCardAgain rates an already-rated card with the same rating and returns
// the new nextReviewAt. Used by the spec B3-test to verify replay advances
// the FSRS schedule.
func (u *fsrsUser) RateCardAgain(t *testing.T, cardID int64, rating string) time.Time {
	t.Helper()
	cu := u.driver.CardsUser(u.user)
	// Use scope "all" so the previously-rated card is still included (it may
	// no longer be "due" after the first rating, but "all" lists every card).
	session := cu.StartSession(t, "all")
	info := cu.RateCard(t, session.SessionID, cardID, rating)
	return u.readCardNextReviewAt(t, cardID, info)
}

// LastRatedCardID returns the card id from the most recent CreateUnratedCard
// or RateFirstReview call. The HTTP response of RateCard does not carry
// card_id, so the driver remembers it at creation time.
func (u *fsrsUser) LastRatedCardID(t *testing.T) int64 {
	t.Helper()
	if u.lastCardID == 0 {
		t.Fatal("fsrsUser: LastRatedCardID called before any card was created/rated")
	}
	return u.lastCardID
}

// readCardNextReviewAt reads next_review_at for a card schedule directly from
// the DB. Test-only: there is no HTTP read path for next_review_at on cards.
func (u *fsrsUser) readCardNextReviewAt(t *testing.T, cardID int64, info any) time.Time {
	t.Helper()
	uid := u.user.UserID(t)
	var due pgtype.Timestamptz
	err := u.driver.pg.Pool.QueryRow(context.Background(),
		`SELECT next_review_at FROM review_schedules WHERE user_id = $1 AND card_id = $2`,
		uid, cardID,
	).Scan(&due)
	if err != nil {
		t.Fatalf("driver: read card next_review_at (card=%d): %v", cardID, err)
	}
	if !due.Valid {
		t.Fatalf("driver: card next_review_at is null (card=%d, info=%+v)", cardID, info)
	}
	return due.Time.UTC()
}

func (u *fsrsUser) token() string {
	if au, ok := u.user.(*authenticatedUser); ok {
		return au.token
	}
	u.t.Fatalf("fsrsUser: expected *authenticatedUser, got %T", u.user)
	return ""
}

// --- FSRSStateProbe (test-only read) ---

// CardScheduleState returns the FSRS-relevant columns of the card's
// review_schedules row. Returns (state, false) when no schedule exists
// (unrated card with no history yet) — a valid state per the B1 invariant.
func (d *Driver) CardScheduleState(t *testing.T, userID, cardID int64) (specifications.FSRSState, bool) {
	t.Helper()
	var (
		state        int16
		stability    float64
		difficulty   float64
		intervalDays float64
		reviewCount  int32
		lapses       int32
		lastReview   pgtype.Timestamptz
		nextReview   pgtype.Timestamptz
	)
	err := d.pg.Pool.QueryRow(context.Background(),
		`SELECT state, stability, difficulty, interval_days, review_count, lapses, last_review_at, next_review_at
		 FROM review_schedules WHERE user_id = $1 AND card_id = $2`,
		userID, cardID,
	).Scan(&state, &stability, &difficulty, &intervalDays, &reviewCount, &lapses, &lastReview, &nextReview)
	if errors.Is(err, pgx.ErrNoRows) {
		return specifications.FSRSState{}, false
	}
	if err != nil {
		t.Fatalf("driver: read card schedule state (card=%d): %v", cardID, err)
	}
	out := specifications.FSRSState{
		State:        int8(state),
		Stability:    stability,
		Difficulty:   difficulty,
		IntervalDays: intervalDays,
		ReviewCount:  int(reviewCount),
		Lapses:       int(lapses),
		NextReviewAt: nextReview.Time.UTC(),
	}
	if lastReview.Valid {
		t := lastReview.Time.UTC()
		out.LastReviewAt = &t
	}
	return out, true
}

// --- QuizProvider / QuizUser ---

func (d *Driver) QuizUser(user specifications.AuthenticatedUser) specifications.QuizUser {
	t := d.t
	return &quizUser{driver: d, user: user, t: t}
}

type quizUser struct {
	driver *Driver
	user   specifications.AuthenticatedUser
	t      *testing.T
}

func (u *quizUser) OwnIdentity(t *testing.T) string { return u.user.OwnIdentity(t) }
func (u *quizUser) UserID(t *testing.T) int64       { return u.user.UserID(t) }

func (u *quizUser) GetSession(t *testing.T, limit int32) specifications.SessionInfo {
	t.Helper()
	path := fmt.Sprintf("/api/v1/me/quiz/session?limit=%d", limit)
	resp := u.driver.do(t, http.MethodGet, path, nil, u.token())

	var out struct {
		Data struct {
			Questions []struct {
				ID        int64  `json:"id"`
				Question  string `json:"question"`
				ProblemID *int64 `json:"problem_id"`
			} `json:"questions"`
		} `json:"data"`
	}
	u.driver.decode(t, resp, &out)

	info := specifications.SessionInfo{}
	for _, q := range out.Data.Questions {
		info.Cards = append(info.Cards, specifications.CardInfo{
			ID:        q.ID,
			Front:     q.Question,
			ProblemID: q.ProblemID,
		})
	}
	return info
}

func (u *quizUser) AnswerQuestion(t *testing.T, questionID int64, option int) specifications.AnswerResult {
	t.Helper()
	body := map[string]int{"option": option}
	path := fmt.Sprintf("/api/v1/me/quiz/%d/answer", questionID)
	resp := u.driver.do(t, http.MethodPost, path, body, u.token())

	var out struct {
		Data struct {
			Correct       bool `json:"correct"`
			CorrectOption int  `json:"correct_option"`
		} `json:"data"`
	}
	u.driver.decode(t, resp, &out)

	return specifications.AnswerResult{
		Correct:       out.Data.Correct,
		CorrectOption: out.Data.CorrectOption,
	}
}

// AnswerQuestionAgain повторяет ответ и НЕ падает на non-2xx, чтобы спека
// могла проверить отклонение анти-читом. true = ответ отклонён (409 Conflict).
func (u *quizUser) AnswerQuestionAgain(t *testing.T, questionID int64, option int) bool {
	t.Helper()
	body := map[string]int{"option": option}
	path := fmt.Sprintf("/api/v1/me/quiz/%d/answer", questionID)
	resp := u.driver.do(t, http.MethodPost, path, body, u.token())
	defer func() {
		if err := resp.Body.Close(); err != nil {
			t.Fatalf("driver: close replay response body: %v", err)
		}
	}()
	return resp.StatusCode == http.StatusConflict
}

func (u *quizUser) token() string {
	if au, ok := u.user.(*authenticatedUser); ok {
		return au.token
	}
	u.t.Fatalf("quizUser: expected *authenticatedUser, got %T", u.user)
	return ""
}

// --- QuizSeeder (test-only, прямой доступ к БД) ---

// CreateProblem сеет задачу, принадлежащую пользователю, на платформе 'leetcode'
// (засеена в миграции 000002), и тут же создаёт строку user_problem_progress —
// так же, как POST /me/problems/{id}/save (UpsertProblemProgress). Прогресс с
// confidence=NULL обязателен: иначе UpdateProgressConfidence (UPDATE, не upsert)
// молча no-op'нет, и викторина не сможет сдвинуть confidence.
func (d *Driver) CreateProblem(t *testing.T, ownerUserID int64, title, url, difficulty, slug string) int64 {
	t.Helper()
	var id int64
	err := d.pg.Pool.QueryRow(context.Background(),
		`INSERT INTO problems (platform_id, external_slug, title, url, difficulty, source_type, created_by_user_id)
		 VALUES ((SELECT id FROM platforms WHERE code = 'leetcode'), $1, $2, $3, $4, 'manual', $5)
		 RETURNING id`,
		slug, title, url, difficulty, ownerUserID,
	).Scan(&id)
	if err != nil {
		t.Fatalf("driver: seed problem %q: %v", slug, err)
	}
	if _, err := d.pg.Pool.Exec(context.Background(),
		`INSERT INTO user_problem_progress (user_id, problem_id, status, first_seen_at)
		 VALUES ($1, $2, 'not_started', NOW())
		 ON CONFLICT (user_id, problem_id) DO NOTHING`,
		ownerUserID, id,
	); err != nil {
		t.Fatalf("driver: seed problem progress: %v", err)
	}
	return id
}

// CreateQuizQuestion сеет вопрос викторины, привязанный к problem. Возвращает id.
func (d *Driver) CreateQuizQuestion(t *testing.T, userID, problemID int64, question string, options []string, correctOption int, explanation string) int64 {
	t.Helper()
	optionsJSON, err := json.Marshal(options)
	if err != nil {
		t.Fatalf("driver: marshal options: %v", err)
	}
	var id int64
	err = d.pg.Pool.QueryRow(context.Background(),
		`INSERT INTO quiz_questions (user_id, problem_id, question, options, correct_option, explanation, created_by_ai)
		 VALUES ($1, $2, $3, $4, $5, $6, false)
		 RETURNING id`,
		userID, problemID, question, optionsJSON, correctOption, explanation,
	).Scan(&id)
	if err != nil {
		t.Fatalf("driver: seed quiz question: %v", err)
	}
	return id
}

// --- QuizProbe (test-only read) ---

// Confidence возвращает confidence пользователя по задаче или nil, если строки
// прогресса нет либо confidence IS NULL.
func (d *Driver) Confidence(t *testing.T, userID, problemID int64) *int {
	t.Helper()
	var conf pgtype.Int4
	err := d.pg.Pool.QueryRow(context.Background(),
		`SELECT confidence FROM user_problem_progress WHERE user_id = $1 AND problem_id = $2`,
		userID, problemID,
	).Scan(&conf)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		t.Fatalf("driver: read confidence: %v", err)
	}
	if !conf.Valid {
		return nil
	}
	v := int(conf.Int32)
	return &v
}

// NextReviewAt возвращает запланированную дату повторения задачи или nil,
// если расписания (review_schedules) для задачи нет.
func (d *Driver) NextReviewAt(t *testing.T, userID, problemID int64) *time.Time {
	t.Helper()
	var due pgtype.Timestamptz
	err := d.pg.Pool.QueryRow(context.Background(),
		`SELECT next_review_at FROM review_schedules WHERE user_id = $1 AND problem_id = $2`,
		userID, problemID,
	).Scan(&due)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		t.Fatalf("driver: read next_review_at: %v", err)
	}
	if !due.Valid {
		return nil
	}
	v := due.Time.UTC()
	return &v
}

// --- CardsProvider / CardsUser ---

// CardsUser оборачивает AuthenticatedUser и добавляет карточные операции
func (d *Driver) CardsUser(user specifications.AuthenticatedUser) specifications.CardsUser {
	t := d.t
	return &cardsUser{driver: d, user: user, t: t}
}

// --- Register / AuthenticatedUser (harness spec) ---

func (d *Driver) Register(t *testing.T, email, password string) specifications.AuthenticatedUser {
	t.Helper()
	resp := d.do(t, http.MethodPost, "/api/v1/auth/register",
		map[string]string{"email": email, "password": password}, "")

	var out struct {
		Data struct {
			Tokens struct {
				AccessToken string `json:"access_token"`
			} `json:"tokens"`
		} `json:"data"`
	}
	d.decode(t, resp, &out)
	if out.Data.Tokens.AccessToken == "" {
		t.Fatalf("driver: register %s: response had no access_token", email)
	}
	return &authenticatedUser{driver: d, token: out.Data.Tokens.AccessToken, email: email}
}

// --- CardsUser implementation ---

type cardsUser struct {
	driver *Driver
	user   specifications.AuthenticatedUser
	t      *testing.T
}

func (u *cardsUser) OwnIdentity(t *testing.T) string { return u.user.OwnIdentity(t) }
func (u *cardsUser) UserID(t *testing.T) int64       { return u.user.UserID(t) }

func (u *cardsUser) CreateCard(t *testing.T, front, back, cardType string) specifications.CardInfo {
	t.Helper()
	body := map[string]string{
		"type":  cardType,
		"front": front,
		"back":  back,
	}
	resp := u.driver.do(t, http.MethodPost, "/api/v1/me/cards", body, u.token())

	var out struct {
		Data struct {
			ID    int64  `json:"id"`
			Type  string `json:"type"`
			Front string `json:"front"`
			Back  string `json:"back"`
		} `json:"data"`
	}
	u.driver.decode(t, resp, &out)
	return specifications.CardInfo{
		ID:    out.Data.ID,
		Type:  out.Data.Type,
		Front: out.Data.Front,
		Back:  out.Data.Back,
	}
}

func (u *cardsUser) GetCards(t *testing.T) []specifications.CardInfo {
	t.Helper()
	resp := u.driver.do(t, http.MethodGet, "/api/v1/me/cards?limit=100", nil, u.token())

	var out struct {
		Data []struct {
			ID     int64  `json:"id"`
			Front  string `json:"front"`
			Back   string `json:"back"`
			Type   string `json:"type"`
			Status string `json:"status"`
		} `json:"data"`
	}
	u.driver.decode(t, resp, &out)

	cards := make([]specifications.CardInfo, len(out.Data))
	for i, c := range out.Data {
		cards[i] = specifications.CardInfo{
			ID:     c.ID,
			Front:  c.Front,
			Back:   c.Back,
			Type:   c.Type,
			Status: c.Status,
		}
	}
	return cards
}

func (u *cardsUser) StartSession(t *testing.T, scope string) specifications.SessionInfo {
	t.Helper()
	path := "/api/v1/me/cards/session?limit=100&scope=" + scope
	resp := u.driver.do(t, http.MethodGet, path, nil, u.token())

	var out struct {
		Data struct {
			SessionID string `json:"sessionId"`
			Cards     []struct {
				ID     int64  `json:"id"`
				Front  string `json:"front"`
				Back   string `json:"back"`
				Type   string `json:"type"`
				Status string `json:"status"`
			} `json:"cards"`
		} `json:"data"`
	}
	u.driver.decode(t, resp, &out)

	info := specifications.SessionInfo{SessionID: out.Data.SessionID}
	for _, c := range out.Data.Cards {
		info.Cards = append(info.Cards, specifications.CardInfo{
			ID:     c.ID,
			Front:  c.Front,
			Back:   c.Back,
			Type:   c.Type,
			Status: c.Status,
		})
	}
	return info
}

func (u *cardsUser) RateCard(t *testing.T, sessionID string, cardID int64, rating string) specifications.RateInfo {
	t.Helper()
	body := map[string]string{
		"sessionId":  sessionID,
		"rating":     rating,
		"reviewedAt": time.Now().UTC().Format(time.RFC3339),
	}
	path := fmt.Sprintf("/api/v1/me/cards/%d/rate", cardID)
	resp := u.driver.do(t, http.MethodPost, path, body, u.token())

	var out struct {
		Data struct {
			CardID                 int64  `json:"cardId"`
			Rating                 string `json:"rating"`
			RepeatInCurrentSession bool   `json:"repeatInCurrentSession"`
			SessionProgress        struct {
				Reviewed  int `json:"reviewed"`
				Remaining int `json:"remaining"`
			} `json:"sessionProgress"`
		} `json:"data"`
	}
	u.driver.decode(t, resp, &out)

	return specifications.RateInfo{
		CardID:                 out.Data.CardID,
		Rating:                 out.Data.Rating,
		RepeatInCurrentSession: out.Data.RepeatInCurrentSession,
		Reviewed:               out.Data.SessionProgress.Reviewed,
		Remaining:              out.Data.SessionProgress.Remaining,
	}
}

func (u *cardsUser) token() string {
	// Извлекаем токен через type-assertion: это допустимо, т.к. драйвер сам
	// создаёт AuthenticatedUser и контролирует его тип.
	if au, ok := u.user.(*authenticatedUser); ok {
		return au.token
	}
	u.t.Fatalf("cardsUser: expected *authenticatedUser, got %T", u.user)
	return ""
}

// --- Internal authenticatedUser (harness spec) ---

type authenticatedUser struct {
	driver *Driver
	token  string
	email  string
}

// OwnIdentity отправляет GET-запрос на /api/v1/me
// и возвращает email, который сообщает сервер.
func (u *authenticatedUser) OwnIdentity(t *testing.T) string {
	t.Helper()
	resp := u.driver.do(t, http.MethodGet, "/api/v1/me", nil, u.token)

	var out struct {
		Data struct {
			User struct {
				Email string `json:"email"`
			} `json:"user"`
		} `json:"data"`
	}
	u.driver.decode(t, resp, &out)
	return out.Data.User.Email
}

// UserID резолвит числовой id пользователя по email (test-only: нужен seed/probe).
func (u *authenticatedUser) UserID(t *testing.T) int64 {
	t.Helper()
	var id int64
	err := u.driver.pg.Pool.QueryRow(context.Background(),
		"SELECT id FROM users WHERE email = $1", u.email,
	).Scan(&id)
	if err != nil {
		t.Fatalf("driver: resolve user id for %q: %v", u.email, err)
	}
	return id
}

// --- HTTP helpers ---

// do выполняет HTTP-запрос к тестовому серверу, добавляя Bearer-токен,
// если он передан, и завершает тест при любой транспортной ошибке.
func (d *Driver) do(t *testing.T, method, path string, body any, token string) *http.Response {
	t.Helper()
	var rdr io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("driver: marshal body: %v", err)
		}
		rdr = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, d.srv.URL+path, rdr)
	if err != nil {
		t.Fatalf("driver: build request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := d.client.Do(req)
	if err != nil {
		t.Fatalf("driver: %s %s: %v", method, path, err)
	}
	return resp
}

// decode считывает тело ответа в dst, убеждается, что сервер вернул
// успешный статус (2xx), а при ошибке выводит тело ответа сервера,
// чтобы причина сбоя была сразу видна.
func (d *Driver) decode(t *testing.T, resp *http.Response, dst any) {
	t.Helper()
	defer func() {
		if err := resp.Body.Close(); err != nil {
			t.Fatalf("driver: close response body: %v", err)
		}
	}()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatalf("driver: read error response body: %v", err)
		}
		t.Fatalf("driver: %s %s: status %d, body %s",
			resp.Request.Method, resp.Request.URL.Path, resp.StatusCode, string(raw))
	}
	if err := json.NewDecoder(resp.Body).Decode(dst); err != nil {
		t.Fatalf("driver: decode response: %v", err)
	}
}
