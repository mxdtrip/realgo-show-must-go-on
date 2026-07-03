// Package http — драйвер acceptance-тестов: единственное место, которое знает
// о существовании HTTP. Он поднимает настоящий сервер внутри процесса,
// взаимодействует с ним через реальный сокет (httptest.Server) и предоставляет
// спецификациям объект предметной области, через который они могут управлять
// системой. Благодаря этому спецификации остаются независимыми от транспорта
// и действительно работают как black-box тесты. Аутентификация проходит через
// реальный сценарий POST /auth/register → Bearer, без каких-либо обходных путей.
package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server"
	"github.com/mxdtrip/freeburger/services/api/internal/specifications"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/redis"
	"github.com/mxdtrip/freeburger/services/api/internal/testutil"
)

// Driver реализует specifications.HarnessProvider и specifications.CardsProvider
// поверх реального HTTP-сервера.
var (
	_ specifications.HarnessProvider = (*Driver)(nil)
	_ specifications.CardsProvider   = (*Driver)(nil)
)

// testJWTSecret имеет длину не менее 32 байт и не содержит заглушки вида
// "replace-with", поэтому механизм подписи JWT принимает его.
// Драйвер создаёт auth.Config напрямую, минуя auth.LoadConfig,
// который читает конфигурацию из окружения.
const testJWTSecret = "acceptance-test-jwt-secret-32-bytes"

// Driver управляет встроенным httptest.Server,
// запущенным с настоящим HTTP-обработчиком.
type Driver struct {
	t      *testing.T
	srv    *httptest.Server
	client *http.Client
}

// New собирает настоящий сервер из конфигурации контейнеров harness'а
// тем же способом, которым app.go собирает production-приложение,
// после чего запускает его на случайном свободном порту.
func New(t *testing.T, h *testutil.Harness) *Driver {
	t.Helper()
	ctx := context.Background()

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

	handler := server.New(server.Deps{
		Logger:   slog.Default(),
		Postgres: pg,
		Redis:    rd,
		Auth:     authSvc,
	})

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	return &Driver{t: t, srv: srv, client: srv.Client()}
}

// Close останавливает тестовый сервер.
// Обычно завершение уже зарегистрировано через t.Cleanup;
// Close существует для случаев, когда вызывающей стороне удобнее
// явно управлять жизненным циклом.
func (d *Driver) Close() { d.srv.Close() }

// CardsUser оборачивает AuthenticatedUser и добавляет карточные операции,
// реализуя specifications.CardsUser.
func (d *Driver) CardsUser(user specifications.AuthenticatedUser) specifications.CardsUser {
	t := d.t // capture for helper calls
	return &cardsUser{
		driver: d,
		user:   user,
		t:      t,
	}
}

// --- Register / AuthenticatedUser (harness spec) ---

// Register отправляет POST-запрос на /api/v1/auth/register
// и возвращает уже аутентифицированного пользователя.
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
	return &authenticatedUser{driver: d, token: out.Data.Tokens.AccessToken}
}

// --- CardsUser implementation ---

// cardsUser реализует specifications.CardsUser поверх HTTP.
type cardsUser struct {
	driver *Driver
	user   specifications.AuthenticatedUser
	t      *testing.T
}

func (u *cardsUser) OwnIdentity(t *testing.T) string {
	return u.user.OwnIdentity(t)
}

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
		"sessionId": sessionID,
		"rating":    rating,
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
	// Extract token from authenticatedUser via type assertion.
	// This is acceptable because the driver owns the AuthenticatedUser creation.
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
