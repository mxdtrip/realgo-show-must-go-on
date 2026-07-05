//go:build integration

package integration

import (
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

	"github.com/stretchr/testify/require"

	"github.com/mxdtrip/freeburger/services/api/internal/ai"
	"github.com/mxdtrip/freeburger/services/api/internal/ai/aitest"
	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/config"
	"github.com/mxdtrip/freeburger/services/api/internal/server"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/redis"
)

// newAIHarness wires a full server.Handler with a fake, network-free AI
// provider behind the real CardProvisioner (real Postgres + Redis, real
// lock), so these tests exercise the actual idempotency and locking code
// paths without ever calling out to Gemini.
func newAIHarness(t *testing.T) (http.Handler, *postgres.Storage, *redis.Storage, *aitest.Fake) {
	t.Helper()
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

	fake := aitest.New()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	provisioner := ai.NewProvisioner(ai.NewRepository(pg.Pool), rdb, fake, logger)

	h := server.New(server.Deps{
		Logger:          logger,
		Postgres:        pg,
		Redis:           rdb,
		Auth:            authSvc,
		CardProvisioner: provisioner,
	})

	t.Cleanup(func() {
		_ = rdb.Close()
		pg.Close()
	})
	return h, pg, rdb, fake
}

func solveExtensionEvent(t *testing.T, h http.Handler, token, eventID, slug, title string) map[string]any {
	t.Helper()
	return postJSON(t, h, "/api/v1/extension/events", token, map[string]any{
		"eventId":          eventID,
		"source":           "leetcode",
		"event":            "problem_solved",
		"occurredAt":       time.Now().Add(-time.Hour).UTC().Format(time.RFC3339),
		"rating":           "normal",
		"extensionVersion": "integration",
		"problem": map[string]any{
			"externalId": slug,
			"title":      title,
			"url":        "https://leetcode.com/problems/" + slug + "/",
			"difficulty": "easy",
		},
	})
}

// pollProblemCards polls GET /me/problems/{id}/cards until status is no
// longer "generating" (or timeout), mirroring the client polling contract
// documented for this endpoint.
func pollProblemCards(t *testing.T, h http.Handler, token string, problemID int64, timeout time.Duration) map[string]any {
	t.Helper()
	// ProvisionAsync spawns a goroutine, so there's a brief window right after
	// the solve event where it hasn't acquired the lock yet: a poll landing in
	// that window would see "none" (no cards, no lock) and stop too early.
	// Require "none" to hold for a short settle window before accepting it,
	// matching the fact that a real client caps polling instead of trusting
	// the very first response.
	const settleWindow = 300 * time.Millisecond

	start := time.Now()
	deadline := start.Add(timeout)
	var last map[string]any
	for time.Now().Before(deadline) {
		body := getJSON(t, h, fmt.Sprintf("/api/v1/me/problems/%d/cards", problemID), token)
		data := body["data"].(map[string]any)
		last = data
		switch data["status"] {
		case "ready":
			return data
		case "none":
			if time.Since(start) >= settleWindow {
				return data
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for generation to finish, last status: %+v", last)
	return nil
}

func TestAICardGeneration_SubmitGeneratesCardsAndIsIdempotent(t *testing.T) {
	h, pg, _, fake := newAIHarness(t)
	ctx := context.Background()

	suffix := time.Now().UTC().Format("20060102150405.000000000")
	email := "ai-cards-" + suffix + "@example.test"
	eventID := "ai-cards-event-" + suffix
	slug := "ai-cards-two-sum-" + suffix
	t.Cleanup(func() {
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM extension_events WHERE idempotency_key = $1", eventID)
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM problems WHERE external_slug = $1", slug)
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM users WHERE email = $1", email)
	})

	token := register(t, h, email)

	submit := solveExtensionEvent(t, h, token, eventID, slug, "AI Cards Two Sum")
	problemID := int64(submit["data"].(map[string]any)["problemId"].(float64))

	// 1. Submit -> generation runs -> cards appear as "ready".
	status := pollProblemCards(t, h, token, problemID, 10*time.Second)
	require.Equal(t, "ready", status["status"])
	cardsData := status["cards"].([]any)
	require.Len(t, cardsData, 3)
	seenTypes := map[string]bool{}
	cardIDs := make(map[float64]bool, 3)
	for _, raw := range cardsData {
		c := raw.(map[string]any)
		require.Equal(t, true, c["createdByAi"], "generated cards must report createdByAi=true")
		seenTypes[c["type"].(string)] = true
		cardIDs[c["id"].(float64)] = true
	}
	require.True(t, seenTypes["pattern_recognition"] && seenTypes["algorithm_mechanics"] && seenTypes["edge_case"],
		"expected all three card types, got %v", seenTypes)
	require.Equal(t, 1, fake.Calls(), "one submit should trigger exactly one generation call")

	// 2. Cards appear in the solver's review session (scope=all picks up
	// freshly generated global cards with no schedule yet).
	session := getJSON(t, h, "/api/v1/me/cards/session?scope=all&limit=200", token)
	sessionCards := session["data"].(map[string]any)["cards"].([]any)
	sessionIDs := make(map[float64]bool, len(sessionCards))
	for _, raw := range sessionCards {
		sessionIDs[raw.(map[string]any)["id"].(float64)] = true
	}
	for id := range cardIDs {
		require.True(t, sessionIDs[id], "generated card %v must appear in the solver's session", id)
	}

	// 3. Resubmitting (duplicate idempotency key) must not call the LLM again.
	solveExtensionEvent(t, h, token, eventID, slug, "AI Cards Two Sum")
	require.Eventually(t, func() bool { return fake.Calls() == 1 }, 2*time.Second, 50*time.Millisecond,
		"resubmitting an already-generated problem must not trigger a new LLM call")

	statusAfterResubmit := pollProblemCards(t, h, token, problemID, 5*time.Second)
	require.Equal(t, "ready", statusAfterResubmit["status"])
	require.Len(t, statusAfterResubmit["cards"].([]any), 3, "resubmitting must not duplicate cards")
}

func TestAICardGeneration_ConcurrentSubmitsGenerateExactlyOnce(t *testing.T) {
	h, pg, _, fake := newAIHarness(t)
	ctx := context.Background()

	suffix := time.Now().UTC().Format("20060102150405.000000000")
	email := "ai-cards-race-" + suffix + "@example.test"
	slug := "ai-cards-race-two-sum-" + suffix
	t.Cleanup(func() {
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM extension_events WHERE url LIKE $1", "%"+slug+"%")
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM problems WHERE external_slug = $1", slug)
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM users WHERE email = $1", email)
	})

	token := register(t, h, email)

	const workers = 8
	var wg sync.WaitGroup
	start := make(chan struct{})
	problemIDs := make([]int64, workers)
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			resp := solveExtensionEvent(t, h, token, fmt.Sprintf("ai-cards-race-event-%s-%d", suffix, i), slug, "AI Cards Race Two Sum")
			problemIDs[i] = int64(resp["data"].(map[string]any)["problemId"].(float64))
		}(i)
	}
	close(start)
	wg.Wait()

	problemID := problemIDs[0]
	for _, id := range problemIDs {
		require.Equal(t, problemID, id, "all concurrent submits of the same slug must resolve to one problem")
	}

	status := pollProblemCards(t, h, token, problemID, 10*time.Second)
	require.Equal(t, "ready", status["status"])
	require.Len(t, status["cards"].([]any), 3)

	require.Equal(t, 1, fake.Calls(), "concurrent submits of the same problem must generate exactly once")

	var globalAICardCount int64
	require.NoError(t, pg.Pool.QueryRow(ctx, `
SELECT COUNT(*) FROM cards c
JOIN problems p ON p.id = c.problem_id
WHERE p.external_slug = $1 AND c.user_id IS NULL AND c.created_by_ai = TRUE`, slug,
	).Scan(&globalAICardCount))
	require.Equal(t, int64(3), globalAICardCount, "the unique index must prevent duplicate cards under a lock race")
}

func TestAICardGeneration_UnknownProblemReportsNone(t *testing.T) {
	h, pg, _, fake := newAIHarness(t)
	ctx := context.Background()
	fake.Err = ai.ErrUnknownProblem

	suffix := time.Now().UTC().Format("20060102150405.000000000")
	email := "ai-cards-unknown-" + suffix + "@example.test"
	eventID := "ai-cards-unknown-event-" + suffix
	slug := "ai-cards-unknown-" + suffix
	t.Cleanup(func() {
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM extension_events WHERE idempotency_key = $1", eventID)
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM problems WHERE external_slug = $1", slug)
		_, _ = pg.Pool.Exec(ctx, "DELETE FROM users WHERE email = $1", email)
	})

	token := register(t, h, email)
	submit := solveExtensionEvent(t, h, token, eventID, slug, "Some Obscure Problem")
	problemID := int64(submit["data"].(map[string]any)["problemId"].(float64))

	status := pollProblemCards(t, h, token, problemID, 10*time.Second)
	require.Equal(t, "none", status["status"])
	require.Empty(t, status["cards"].([]any))
}

func TestAICardGeneration_UnknownProblemID404s(t *testing.T) {
	h, _, _, _ := newAIHarness(t)
	email := "ai-cards-404-" + time.Now().UTC().Format("20060102150405.000000000") + "@example.test"
	token := register(t, h, email)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/me/problems/999999999/cards", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusNotFound, w.Code)

	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Equal(t, "NOT_FOUND", body["error"].(map[string]any)["code"])
}
