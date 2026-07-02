// Package http is the acceptance-test driver: the single place that knows about
// HTTP. It builds the real server in-process, talks to it over a real socket
// (httptest.Server), and exposes a domain-level handle the specifications can
// drive — keeping the specs transport-agnostic and genuinely black-box. Auth is
// exercised through the real POST /auth/register -> Bearer flow, not bypassed.
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

// Driver satisfies specifications.HarnessProvider against the real HTTP server.
var _ specifications.HarnessProvider = (*Driver)(nil)

// testJWTSecret is >=32 bytes and contains no "replace-with" placeholder, so the
// auth signing path accepts it. The driver builds auth.Config directly,
// bypassing the env-driven auth.LoadConfig.
const testJWTSecret = "acceptance-test-jwt-secret-32-bytes"

// Driver owns an in-process httptest.Server running the real handler.
type Driver struct {
	t      *testing.T
	srv    *httptest.Server
	client *http.Client
}

// New wires the real server — rebuilt from the harness's container configs the
// same way app.go wires production — and serves it on an ephemeral port.
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

// Close shuts the test server. t.Cleanup already wires teardown; Close is a
// convenience for callers that prefer an explicit lifecycle.
func (d *Driver) Close() { d.srv.Close() }

// Register POSTs /api/v1/auth/register and returns an authenticated user.
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

// OwnIdentity GETs /api/v1/me and returns the email the server reports.
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

// do performs an HTTP request against the server, attaching the bearer token
// when present, and fails the test on any transport error.
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

// decode reads the response body into dst and asserts a 2xx status, surfacing
// the server's error body on failure.
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
