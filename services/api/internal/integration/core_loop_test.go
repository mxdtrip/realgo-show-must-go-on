//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/config"
	"github.com/mxdtrip/freeburger/services/api/internal/server"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/redis"
)

func TestCoreLoopAuthEventsQueueRate(t *testing.T) {
	ctx := context.Background()
	pg, err := postgres.New(ctx, &config.Database{
		Host: "localhost", Port: 5432, User: "postgres", Password: "postgres",
		DBName: "freeburger", SSLMode: "disable", MaxConns: 2,
		MaxConnLifetime: time.Hour, MaxConnIdleTime: time.Minute,
	})
	require.NoError(t, err)

	rdb, err := redis.New(ctx, &config.Redis{Host: "localhost", Port: "6379"})
	require.NoError(t, err)

	authSvc := auth.NewService(db.New(pg.Pool), rdb.Client, auth.Config{
		JWTSecret:  []byte("integration-secret-with-more-than-32-bytes"),
		AccessTTL:  time.Hour,
		RefreshTTL: time.Hour,
		Issuer:     "freeburger",
	})
	h := server.New(server.Deps{
		Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
		Postgres: pg,
		Redis:    rdb,
		Auth:     authSvc,
	})

	suffix := time.Now().UTC().Format("20060102150405.000000000")
	email := "core-loop-" + suffix + "@example.test"
	eventID := "core-loop-event-" + suffix
	slug := "integration-two-sum-" + suffix
	defer func() {
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM extension_events WHERE idempotency_key = $1", eventID)
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM problems WHERE external_slug = $1", slug)
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM users WHERE email = $1", email)
		_ = rdb.Close()
		pg.Close()
	}()

	token := register(t, h, email)
	postJSON(t, h, "/api/v1/extension/events", token, map[string]any{
		"eventId": eventID, "source": "leetcode", "event": "problem_solved",
		"occurredAt": time.Now().Add(-48 * time.Hour).UTC().Format(time.RFC3339),
		"rating":     "hard", "extensionVersion": "integration",
		"problem": map[string]any{"externalId": slug, "title": "Integration Two Sum", "url": "https://leetcode.com/problems/two-sum/", "difficulty": "easy"},
	})
	duplicate := postJSON(t, h, "/api/v1/extension/events", token, map[string]any{
		"eventId": eventID, "source": "leetcode", "event": "problem_solved",
		"occurredAt": time.Now().Add(-48 * time.Hour).UTC().Format(time.RFC3339),
		"rating":     "hard", "problem": map[string]any{"externalId": slug, "title": "Integration Two Sum", "url": "https://leetcode.com/problems/two-sum/"},
	})
	require.True(t, duplicate["data"].(map[string]any)["duplicate"].(bool))

	queue := getJSON(t, h, "/api/v1/me/reviews/queue", token)
	items := queue["data"].([]any)
	require.NotEmpty(t, items)
	reviewID := int64(items[0].(map[string]any)["id"].(float64))

	rated := postJSON(t, h, "/api/v1/me/reviews/"+strconv.FormatInt(reviewID, 10)+"/rate", token, map[string]any{
		"rating": "normal", "reviewedAt": time.Now().UTC().Format(time.RFC3339),
	})
	require.Equal(t, "completed", rated["data"].(map[string]any)["status"])
}

func register(t *testing.T, h http.Handler, email string) string {
	body := postJSON(t, h, "/api/v1/auth/register", "", map[string]any{"email": email, "password": "Password123!"})
	return body["data"].(map[string]any)["tokens"].(map[string]any)["access_token"].(string)
}

func postJSON(t *testing.T, h http.Handler, path, token string, payload map[string]any) map[string]any {
	b, err := json.Marshal(payload)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return do(t, h, req)
}

func getJSON(t *testing.T, h http.Handler, path, token string) map[string]any {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	return do(t, h, req)
}

func do(t *testing.T, h http.Handler, req *http.Request) map[string]any {
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.True(t, w.Code >= http.StatusOK && w.Code < http.StatusMultipleChoices, w.Body.String())
	var out map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &out))
	return out
}
