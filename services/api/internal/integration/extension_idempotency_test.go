//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/require"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/config"
	"github.com/mxdtrip/freeburger/services/api/internal/server"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/redis"
)

func TestExtensionEventIdempotencyUnderConcurrentPosts(t *testing.T) {
	ctx := context.Background()
	pg, err := postgres.New(ctx, &config.Database{
		Host: "localhost", Port: 5432, User: "postgres", Password: "postgres",
		DBName: "freeburger", SSLMode: "disable", MaxConns: 16,
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
	email := "extension-race-" + suffix + "@example.test"
	eventID := "extension-race-event-" + suffix
	slug := "extension-race-two-sum-" + suffix
	defer func() {
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM extension_events WHERE idempotency_key = $1", eventID)
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM problems WHERE external_slug = $1", slug)
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM users WHERE email = $1", email)
		_ = rdb.Close()
		pg.Close()
	}()

	token := register(t, h, email)
	user, err := db.New(pg.Pool).GetUserByEmail(ctx, email)
	require.NoError(t, err)

	emptyStatus := getJSON(t, h, "/api/v1/me/extension/status", token)
	emptyStatusData := emptyStatus["data"].(map[string]any)
	require.Equal(t, false, emptyStatusData["connected"])
	require.Empty(t, emptyStatusData["platforms"])
	require.Empty(t, emptyStatusData["recentEvents"])

	payload := map[string]any{
		"eventId":          eventID,
		"source":           "leetcode",
		"event":            "problem_solved",
		"occurredAt":       time.Now().Add(-time.Hour).UTC().Format(time.RFC3339),
		"rating":           "normal",
		"extensionVersion": "integration",
		"problem": map[string]any{
			"externalId": slug,
			"title":      "Extension Race Two Sum",
			"url":        "https://leetcode.com/problems/two-sum/",
			"difficulty": "easy",
		},
	}

	const workers = 16
	start := make(chan struct{})
	results := make(chan concurrentPostResult, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			body, status, err := postJSONConcurrent(h, "/api/v1/extension/events", token, payload)
			results <- concurrentPostResult{body: body, status: status, err: err}
		}()
	}
	close(start)
	wg.Wait()
	close(results)

	freshAccepts := 0
	for res := range results {
		require.NoError(t, res.err)
		require.Equal(t, http.StatusOK, res.status, "%#v", res.body)
		data := res.body["data"].(map[string]any)
		require.Equal(t, true, data["accepted"])
		if duplicate, _ := data["duplicate"].(bool); !duplicate {
			freshAccepts++
		}
	}
	require.Equal(t, 1, freshAccepts, "exactly one request should win the idempotency race")

	require.Equal(t, int64(1), countRows(t, ctx, pg, "SELECT COUNT(*) FROM extension_events WHERE idempotency_key = $1", eventID))
	require.Equal(t, int64(1), countRows(t, ctx, pg, `
SELECT COUNT(*)
FROM user_problem_progress upp
JOIN problems p ON p.id = upp.problem_id
WHERE upp.user_id = $1 AND p.external_slug = $2`, user.ID, slug))
	require.Equal(t, int64(1), countRows(t, ctx, pg, `
SELECT COUNT(*)
FROM review_schedules rs
JOIN problems p ON p.id = rs.problem_id
WHERE rs.user_id = $1 AND p.external_slug = $2`, user.ID, slug))

	status := getJSON(t, h, "/api/v1/me/extension/status?limit=1", token)
	statusData := status["data"].(map[string]any)
	require.Equal(t, true, statusData["connected"])
	platforms := statusData["platforms"].([]any)
	require.Len(t, platforms, 1)
	require.Equal(t, "leetcode", platforms[0].(map[string]any)["source"])
	require.Equal(t, "connected", platforms[0].(map[string]any)["status"])
	recentEvents := statusData["recentEvents"].([]any)
	require.Len(t, recentEvents, 1)
	require.Equal(t, eventID, recentEvents[0].(map[string]any)["id"])
	require.Equal(t, "problem_solved", recentEvents[0].(map[string]any)["event"])
}

type concurrentPostResult struct {
	body   map[string]any
	status int
	err    error
}

func postJSONConcurrent(h http.Handler, path, token string, payload map[string]any) (map[string]any, int, error) {
	b, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code < http.StatusOK || w.Code >= http.StatusMultipleChoices {
		return nil, w.Code, fmt.Errorf("unexpected status %d: %s", w.Code, w.Body.String())
	}

	var out map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		return nil, w.Code, err
	}
	return out, w.Code, nil
}

func countRows(t *testing.T, ctx context.Context, pg *postgres.Storage, query string, args ...any) int64 {
	t.Helper()
	var count int64
	require.NoError(t, pg.Pool.QueryRow(ctx, query, args...).Scan(&count))
	return count
}

func TestExtensionSolvedCreatesSchedule(t *testing.T) {
	ctx := context.Background()

	pg, err := postgres.New(ctx, &config.Database{
		Host:            "localhost",
		Port:            5432,
		User:            "postgres",
		Password:        "postgres",
		DBName:          "freeburger",
		SSLMode:         "disable",
		MaxConns:        16,
		MaxConnLifetime: time.Hour,
		MaxConnIdleTime: time.Minute,
	})
	require.NoError(t, err)

	rdb, err := redis.New(ctx, &config.Redis{
		Host: "localhost",
		Port: "6379",
	})
	require.NoError(t, err)

	authSvc := auth.NewService(
		db.New(pg.Pool),
		rdb.Client,
		auth.Config{
			JWTSecret:  []byte("integration-secret-with-more-than-32-bytes"),
			AccessTTL:  time.Hour,
			RefreshTTL: time.Hour,
			Issuer:     "freeburger",
		},
	)

	h := server.New(server.Deps{
		Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
		Postgres: pg,
		Redis:    rdb,
		Auth:     authSvc,
	})

	suffix := time.Now().UTC().Format("20060102150405.000000000")

	email := "extension-fsrs-" + suffix + "@example.test"
	eventID := "extension-fsrs-" + suffix
	slug := "extension-fsrs-two-sum-" + suffix

	defer func() {
		_, _ = pg.Pool.Exec(ctx,
			"DELETE FROM extension_events WHERE idempotency_key = $1",
			eventID,
		)
		_, _ = pg.Pool.Exec(ctx,
			"DELETE FROM review_schedules WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
			email,
		)
		_, _ = pg.Pool.Exec(ctx,
			"DELETE FROM user_problem_progress WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
			email,
		)
		_, _ = pg.Pool.Exec(ctx,
			"DELETE FROM problems WHERE external_slug = $1",
			slug,
		)
		_, _ = pg.Pool.Exec(ctx,
			"DELETE FROM users WHERE email = $1",
			email,
		)

		_ = rdb.Close()
		pg.Close()
	}()

	token := register(t, h, email)

	user, err := db.New(pg.Pool).GetUserByEmail(ctx, email)
	require.NoError(t, err)

	occurredAt := time.Now().UTC().Add(-2 * time.Hour).Truncate(time.Second)

	payload := map[string]any{
		"eventId":          eventID,
		"source":           "leetcode",
		"event":            "problem_solved",
		"occurredAt":       occurredAt.Format(time.RFC3339),
		"rating":           "easy",
		"extensionVersion": "integration",
		"problem": map[string]any{
			"externalId": slug,
			"title":      "Two Sum",
			"url":        "https://leetcode.com/problems/two-sum/",
			"difficulty": "easy",
		},
	}

	body, status, err := postJSONConcurrent(
		h,
		"/api/v1/extension/events",
		token,
		payload,
	)

	require.NoError(t, err)
	require.Equal(t, http.StatusOK, status)

	data := body["data"].(map[string]any)
	require.Equal(t, true, data["accepted"])

	var problemID int64
	err = pg.Pool.QueryRow(ctx,
		`SELECT id FROM problems WHERE external_slug=$1`,
		slug,
	).Scan(&problemID)
	require.NoError(t, err)

	q := db.New(pg.Pool)

	schedule, err := q.GetProblemReviewSchedule(ctx, db.GetProblemReviewScheduleParams{
		UserID: user.ID,
		ProblemID: pgtype.Int8{
			Int64: problemID,
			Valid: true,
		},
	})
	require.NoError(t, err)

	require.Greater(t, schedule.IntervalDays, 0.0)
	require.Greater(t, schedule.Stability, 0.0)
	require.Greater(t, schedule.Difficulty, 0.0)

	require.NotEqual(t, int16(0), schedule.State)

	require.True(t, schedule.ReviewCount.Valid)
	require.Equal(t, int32(1), schedule.ReviewCount.Int32)

	require.Equal(t, int32(0), schedule.Lapses)

	require.True(t, schedule.LastReviewAt.Valid)
	require.WithinDuration(
		t,
		occurredAt,
		schedule.LastReviewAt.Time,
		time.Second,
	)

	require.True(t, schedule.NextReviewAt.Valid)
	require.True(t,
		schedule.NextReviewAt.Time.After(schedule.LastReviewAt.Time),
	)

	require.Equal(t, int32(0), schedule.RemainingSteps)
}
