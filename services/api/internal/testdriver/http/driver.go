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

// Driver реализует specifications.HarnessProvider поверх реального HTTP-сервера.
var _ specifications.HarnessProvider = (*Driver)(nil)

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
	t.Cleanup(func() { _ = rd.Close() })

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
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("driver: %s %s: status %d, body %s",
			resp.Request.Method, resp.Request.URL.Path, resp.StatusCode, string(raw))
	}
	if err := json.NewDecoder(resp.Body).Decode(dst); err != nil {
		t.Fatalf("driver: decode response: %v", err)
	}
}
