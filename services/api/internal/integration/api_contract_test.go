//go:build integration

package integration

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/config"
	"github.com/mxdtrip/freeburger/services/api/internal/server"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/redis"
)

const contractJWTSecret = "integration-secret-with-more-than-32-bytes"

var remoteAddrCounter atomic.Uint32

type contractHarness struct {
	ctx     context.Context
	handler http.Handler
	pg      *postgres.Storage
	rdb     *redis.Storage
	remote  string
}

type contractResponse struct {
	status int
	body   map[string]any
	raw    string
}

type contractTokens struct {
	access  string
	refresh string
	userID  int64
}

func TestContractProtectedRoutesRequireBearerTokens(t *testing.T) {
	h := newContractHarness(t)

	expiredToken := signedAccessToken(t, 123, time.Now().Add(-2*time.Hour), time.Minute)
	validEvent := eventPayload("protected-route", time.Now().UTC())

	tests := []struct {
		name     string
		method   string
		path     string
		token    string
		payload  any
		wantCode string
	}{
		{
			name:     "queue missing token",
			method:   http.MethodGet,
			path:     "/api/v1/me/reviews/queue",
			wantCode: "UNAUTHORIZED",
		},
		{
			name:     "extension missing token",
			method:   http.MethodPost,
			path:     "/api/v1/extension/events",
			payload:  validEvent,
			wantCode: "UNAUTHORIZED",
		},
		{
			name:     "queue expired token",
			method:   http.MethodGet,
			path:     "/api/v1/me/reviews/queue",
			token:    expiredToken,
			wantCode: "INVALID_TOKEN",
		},
		{
			name:     "extension malformed token",
			method:   http.MethodPost,
			path:     "/api/v1/extension/events",
			token:    "not-a-jwt",
			payload:  validEvent,
			wantCode: "INVALID_TOKEN",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := h.request(t, tt.method, tt.path, tt.token, tt.payload)
			requireErrorEnvelope(t, resp, http.StatusUnauthorized, tt.wantCode)
		})
	}
}

func TestContractBadBodiesReturnErrorEnvelopes(t *testing.T) {
	h := newContractHarness(t)
	email := uniqueEmail("bad-bodies")
	t.Cleanup(func() { h.cleanupUser(email) })

	tokens := h.register(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokens.refresh) })

	t.Run("auth rejects unknown fields via strict decoder", func(t *testing.T) {
		resp := h.requestRaw(t, http.MethodPost, "/api/v1/auth/login", "", `{
			"email": "`+email+`",
			"password": "Password123!",
			"unexpected": true
		}`)

		requireErrorEnvelope(t, resp, http.StatusBadRequest, "invalid_request")
	})

	t.Run("auth rejects malformed JSON", func(t *testing.T) {
		resp := h.requestRaw(t, http.MethodPost, "/api/v1/auth/login", "", `{"email":`)

		requireErrorEnvelope(t, resp, http.StatusBadRequest, "invalid_request")
	})

	t.Run("review rate rejects malformed JSON with validation error", func(t *testing.T) {
		resp := h.requestRaw(t, http.MethodPost, "/api/v1/me/reviews/1/rate", tokens.access, `{"rating":`)

		requireErrorEnvelope(t, resp, http.StatusBadRequest, "VALIDATION_ERROR")
	})

	t.Run("extension event rejects missing solved rating", func(t *testing.T) {
		payload := eventPayload("missing-rating", time.Now().UTC())
		delete(payload, "rating")

		resp := h.request(t, http.MethodPost, "/api/v1/extension/events", tokens.access, payload)

		requireErrorEnvelope(t, resp, http.StatusBadRequest, "VALIDATION_ERROR")
	})

	t.Run("extension event rejects malformed JSON", func(t *testing.T) {
		resp := h.requestRaw(t, http.MethodPost, "/api/v1/extension/events", tokens.access, `{"eventId":`)

		requireErrorEnvelope(t, resp, http.StatusBadRequest, "VALIDATION_ERROR")
	})
}

func TestContractRefreshTokensRotateOnce(t *testing.T) {
	h := newContractHarness(t)
	email := uniqueEmail("refresh-rotation")
	t.Cleanup(func() { h.cleanupUser(email) })

	tokens := h.register(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokens.refresh) })

	refreshed := h.refresh(t, tokens.refresh)
	t.Cleanup(func() { h.deleteRefreshTokens(refreshed.refresh) })

	require.NotEmpty(t, refreshed.access)
	require.NotEmpty(t, refreshed.refresh)
	require.NotEqual(t, tokens.refresh, refreshed.refresh)

	reused := h.request(t, http.MethodPost, "/api/v1/auth/refresh", "", map[string]any{
		"refresh_token": tokens.refresh,
	})
	requireErrorEnvelope(t, reused, http.StatusUnauthorized, "invalid_token")

	queue := h.request(t, http.MethodGet, "/api/v1/me/reviews/queue", refreshed.access, nil)
	requireQueueEnvelope(t, queue, http.StatusOK)
}

func TestContractExtensionEventsAreIdempotent(t *testing.T) {
	h := newContractHarness(t)
	suffix := uniqueSuffix("idempotency")
	email := "contract-" + suffix + "@example.test"
	eventID := "evt-" + suffix
	slug := "contract-idempotency-" + suffix
	t.Cleanup(func() { h.cleanupEventUserProblem(eventID, email, slug) })

	tokens := h.register(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokens.refresh) })

	payload := eventPayloadFor(eventID, slug, "Contract Idempotency", time.Now().UTC().Add(-48*time.Hour), "hard")
	first := h.request(t, http.MethodPost, "/api/v1/extension/events", tokens.access, payload)
	firstData := requireSuccessEnvelope(t, first, http.StatusOK)
	require.Equal(t, true, boolField(t, firstData, "accepted"))
	require.Equal(t, false, boolField(t, firstData, "duplicate"))

	second := h.request(t, http.MethodPost, "/api/v1/extension/events", tokens.access, payload)
	secondData := requireSuccessEnvelope(t, second, http.StatusOK)
	require.Equal(t, true, boolField(t, secondData, "accepted"))
	require.Equal(t, true, boolField(t, secondData, "duplicate"))

	var eventCount int
	err := h.pg.Pool.QueryRow(h.ctx, `SELECT COUNT(*) FROM extension_events WHERE idempotency_key = $1`, eventID).Scan(&eventCount)
	require.NoError(t, err)
	require.Equal(t, 1, eventCount)

	var scheduleCount int
	var reviewCount int
	err = h.pg.Pool.QueryRow(h.ctx, `
		SELECT COUNT(*), COALESCE(MAX(rs.review_count), 0)::int
		FROM review_schedules rs
		JOIN problems p ON p.id = rs.problem_id
		WHERE rs.user_id = $1 AND p.external_slug = $2
	`, tokens.userID, slug).Scan(&scheduleCount, &reviewCount)
	require.NoError(t, err)
	require.Equal(t, 1, scheduleCount)
	require.Equal(t, 1, reviewCount)
}

func TestContractExtensionEventIdempotencyIsScopedPerUser(t *testing.T) {
	h := newContractHarness(t)
	suffix := uniqueSuffix("idempotency-scope")
	emailA := "contract-a-" + suffix + "@example.test"
	emailB := "contract-b-" + suffix + "@example.test"
	eventID := "evt-" + suffix
	slug := "contract-idempotency-scope-" + suffix
	t.Cleanup(func() {
		_, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM extension_events WHERE idempotency_key = $1`, eventID)
		h.cleanupUser(emailA)
		h.cleanupUser(emailB)
		_, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM problems WHERE external_slug = $1`, slug)
	})

	tokensA := h.register(t, emailA, "Password123!")
	tokensB := h.register(t, emailB, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokensA.refresh, tokensB.refresh) })

	payload := eventPayloadFor(eventID, slug, "Contract Idempotency Scope", time.Now().UTC().Add(-48*time.Hour), "normal")
	firstA := h.request(t, http.MethodPost, "/api/v1/extension/events", tokensA.access, payload)
	firstAData := requireSuccessEnvelope(t, firstA, http.StatusOK)
	require.Equal(t, false, boolField(t, firstAData, "duplicate"))

	firstB := h.request(t, http.MethodPost, "/api/v1/extension/events", tokensB.access, payload)
	firstBData := requireSuccessEnvelope(t, firstB, http.StatusOK)
	require.Equal(t, false, boolField(t, firstBData, "duplicate"))

	replayA := h.request(t, http.MethodPost, "/api/v1/extension/events", tokensA.access, payload)
	replayAData := requireSuccessEnvelope(t, replayA, http.StatusOK)
	require.Equal(t, true, boolField(t, replayAData, "duplicate"))

	var eventCount int
	err := h.pg.Pool.QueryRow(h.ctx, `SELECT COUNT(*) FROM extension_events WHERE idempotency_key = $1`, eventID).Scan(&eventCount)
	require.NoError(t, err)
	require.Equal(t, 2, eventCount)

	var progressCount int
	err = h.pg.Pool.QueryRow(h.ctx, `
		SELECT COUNT(*)
		FROM user_problem_progress upp
		JOIN problems p ON p.id = upp.problem_id
		WHERE p.external_slug = $1 AND upp.user_id IN ($2, $3)
	`, slug, tokensA.userID, tokensB.userID).Scan(&progressCount)
	require.NoError(t, err)
	require.Equal(t, 2, progressCount)

	var scheduleCount int
	err = h.pg.Pool.QueryRow(h.ctx, `
		SELECT COUNT(*)
		FROM review_schedules rs
		JOIN problems p ON p.id = rs.problem_id
		WHERE p.external_slug = $1 AND rs.user_id IN ($2, $3)
	`, slug, tokensA.userID, tokensB.userID).Scan(&scheduleCount)
	require.NoError(t, err)
	require.Equal(t, 2, scheduleCount)
}

func TestCoreLoopRegisterLoginSolveQueueAndRateMovesDue(t *testing.T) {
	h := newContractHarness(t)
	suffix := uniqueSuffix("core-loop")
	email := "contract-" + suffix + "@example.test"
	eventID := "evt-" + suffix
	slug := "contract-core-loop-" + suffix
	t.Cleanup(func() { h.cleanupEventUserProblem(eventID, email, slug) })

	registered := h.register(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(registered.refresh) })

	loggedIn := h.login(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(loggedIn.refresh) })
	require.NotEmpty(t, registered.access)
	require.NotEmpty(t, loggedIn.access)

	eventTime := time.Now().UTC().Add(-48 * time.Hour)
	solve := h.request(t, http.MethodPost, "/api/v1/extension/events", loggedIn.access,
		eventPayloadFor(eventID, slug, "Contract Core Loop", eventTime, "hard"))
	solveData := requireSuccessEnvelope(t, solve, http.StatusOK)
	require.Equal(t, "reviewing", stringField(t, solveData, "status"))

	queueBefore := h.request(t, http.MethodGet, "/api/v1/me/reviews/queue?status=due&limit=50", loggedIn.access, nil)
	queueItems := requireQueueEnvelope(t, queueBefore, http.StatusOK)
	review := findReviewByTitle(t, queueItems, "Contract Core Loop")
	reviewID := int64Field(t, review, "id")
	require.Equal(t, "problem", stringField(t, review, "entityType"))
	require.Equal(t, "due", stringField(t, review, "status"))

	reviewedAt := time.Now().UTC()
	rated := h.request(t, http.MethodPost, "/api/v1/me/reviews/"+strconv.FormatInt(reviewID, 10)+"/rate", loggedIn.access, map[string]any{
		"rating":     "normal",
		"reviewedAt": reviewedAt.Format(time.RFC3339),
	})
	ratedData := requireSuccessEnvelope(t, rated, http.StatusOK)
	nextReviewAt := timeField(t, ratedData, "nextReviewAt")
	require.Equal(t, reviewID, int64Field(t, ratedData, "reviewId"))
	require.Equal(t, "normal", stringField(t, ratedData, "rating"))
	require.Equal(t, "completed", stringField(t, ratedData, "status"))
	require.True(t, nextReviewAt.After(reviewedAt), "nextReviewAt=%s reviewedAt=%s", nextReviewAt, reviewedAt)

	queueAfter := h.request(t, http.MethodGet, "/api/v1/me/reviews/queue?status=due&limit=50", loggedIn.access, nil)
	afterItems := requireQueueEnvelope(t, queueAfter, http.StatusOK)
	requireNoReviewID(t, afterItems, reviewID)
}

func TestContractProtectedRoutesShouldUseUppercaseUnauthorizedCodes(t *testing.T) {
	h := newContractHarness(t)
	resp := h.request(t, http.MethodGet, "/api/v1/me/reviews/queue", "", nil)
	requireErrorEnvelope(t, resp, http.StatusUnauthorized, "UNAUTHORIZED")
}

func TestContractProtectedBodiesShouldRejectUnknownFields(t *testing.T) {
	h := newContractHarness(t)
	email := uniqueEmail("unknown-fields")
	t.Cleanup(func() { h.cleanupUser(email) })
	tokens := h.register(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokens.refresh) })

	payload := eventPayload("unknown-fields", time.Now().UTC())
	payload["unexpected"] = true
	resp := h.request(t, http.MethodPost, "/api/v1/extension/events", tokens.access, payload)
	requireErrorEnvelope(t, resp, http.StatusBadRequest, "VALIDATION_ERROR")

	reviewRate := map[string]any{
		"rating":     "normal",
		"reviewedAt": time.Now().UTC().Format(time.RFC3339),
		"unexpected": true,
	}
	resp = h.request(t, http.MethodPost, "/api/v1/me/reviews/1/rate", tokens.access, reviewRate)
	requireErrorEnvelope(t, resp, http.StatusBadRequest, "VALIDATION_ERROR")
}

func TestContractReviewQueueShouldNotDoubleNestData(t *testing.T) {
	h := newContractHarness(t)
	email := uniqueEmail("queue-shape")
	t.Cleanup(func() { h.cleanupUser(email) })
	tokens := h.register(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokens.refresh) })

	resp := h.request(t, http.MethodGet, "/api/v1/me/reviews/queue", tokens.access, nil)
	require.Equal(t, http.StatusOK, resp.status)
	require.IsType(t, []any{}, resp.body["data"])
}

// TestContractRoadmapTargetAfterOnboarding verifies that target_company and
// target_topics persisted via PATCH /me/profile are reflected back by
// GET /me/roadmap.target: company is enriched to {code, name} via the
// autocomplete catalog and topics are normalised from dashes to underscores.
func TestContractRoadmapTargetAfterOnboarding(t *testing.T) {
	h := newContractHarness(t)
	email := uniqueEmail("roadmap-target")
	t.Cleanup(func() { h.cleanupUser(email) })
	tokens := h.register(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokens.refresh) })

	patch := h.request(t, http.MethodPatch, "/api/v1/me/profile", tokens.access, map[string]any{
		"target_company":      "Google",
		"target_topics":       []string{"two-pointers", "arrays"},
		"interview_date":      "2026-07-21T09:00:00Z",
		"onboarding_completed": true,
	})
	requireSuccessEnvelope(t, patch, http.StatusOK)

	roadmap := h.request(t, http.MethodGet, "/api/v1/me/roadmap", tokens.access, nil)
	data := requireSuccessEnvelope(t, roadmap, http.StatusOK)
	target := objectField(t, data, "target")

	company := objectField(t, target, "company")
	require.Equal(t, "cmp_google", stringField(t, company, "code"), "company.code from /companies/search catalog")
	require.Equal(t, "Google", stringField(t, company, "name"))

	topics, ok := target["topics"].([]any)
	require.True(t, ok, "expected target.topics array, got %T", target["topics"])
	require.Equal(t, []any{"two_pointers", "arrays"}, topics, "topics must be normalised to snake_case")

	date, ok := target["interviewDate"].(string)
	require.True(t, ok, "expected target.interviewDate string, got %T", target["interviewDate"])
	require.Contains(t, date, "2026-07-21")
}

// TestContractRoadmapTargetEmptyForFreshUser verifies that a freshly registered
// user (no onboarding yet) gets target.company == null and target.topics == []
// rather than null/missing, so the frontend never has to guard against null.
func TestContractRoadmapTargetEmptyForFreshUser(t *testing.T) {
	h := newContractHarness(t)
	email := uniqueEmail("roadmap-empty")
	t.Cleanup(func() { h.cleanupUser(email) })
	tokens := h.register(t, email, "Password123!")
	t.Cleanup(func() { h.deleteRefreshTokens(tokens.refresh) })

	roadmap := h.request(t, http.MethodGet, "/api/v1/me/roadmap", tokens.access, nil)
	data := requireSuccessEnvelope(t, roadmap, http.StatusOK)
	target := objectField(t, data, "target")

	require.Nil(t, target["company"], "target.company must be null for a fresh user")
	topics, ok := target["topics"].([]any)
	require.True(t, ok, "target.topics must be an empty array, got %T", target["topics"])
	require.Empty(t, topics, "target.topics must be empty for a fresh user")
}

func newContractHarness(t *testing.T) *contractHarness {
	t.Helper()

	ctx := context.Background()
	pg, err := postgres.New(ctx, &config.Database{
		Host:            "localhost",
		Port:            5432,
		User:            "postgres",
		Password:        "postgres",
		DBName:          "freeburger",
		SSLMode:         "disable",
		MaxConns:        2,
		MaxConnLifetime: time.Hour,
		MaxConnIdleTime: time.Minute,
	})
	require.NoError(t, err)

	rdb, err := redis.New(ctx, &config.Redis{Host: "localhost", Port: "6379"})
	require.NoError(t, err)

	authSvc := auth.NewService(db.New(pg.Pool), rdb.Client, auth.Config{
		JWTSecret:  []byte(contractJWTSecret),
		AccessTTL:  time.Hour,
		RefreshTTL: time.Hour,
		Issuer:     "freeburger",
	})
	handler := server.New(server.Deps{
		Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
		Postgres: pg,
		Redis:    rdb,
		Auth:     authSvc,
	})

	h := &contractHarness{
		ctx:     ctx,
		handler: handler,
		pg:      pg,
		rdb:     rdb,
		remote:  nextRemoteAddr(),
	}
	t.Cleanup(func() {
		_ = rdb.Close()
		pg.Close()
	})
	return h
}

func (h *contractHarness) register(t *testing.T, email, password string) contractTokens {
	t.Helper()

	resp := h.request(t, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"email":    email,
		"password": password,
	})
	data := requireSuccessEnvelope(t, resp, http.StatusCreated)
	tokens := tokensFromData(t, data)
	tokens.userID = int64Field(t, objectField(t, data, "user"), "id")
	return tokens
}

func (h *contractHarness) login(t *testing.T, email, password string) contractTokens {
	t.Helper()

	resp := h.request(t, http.MethodPost, "/api/v1/auth/login", "", map[string]any{
		"email":    email,
		"password": password,
	})
	data := requireSuccessEnvelope(t, resp, http.StatusOK)
	tokens := tokensFromData(t, data)
	tokens.userID = int64Field(t, objectField(t, data, "user"), "id")
	return tokens
}

func (h *contractHarness) refresh(t *testing.T, refreshToken string) contractTokens {
	t.Helper()

	resp := h.request(t, http.MethodPost, "/api/v1/auth/refresh", "", map[string]any{
		"refresh_token": refreshToken,
	})
	data := requireSuccessEnvelope(t, resp, http.StatusOK)
	return tokensFromData(t, data)
}

func (h *contractHarness) request(t *testing.T, method, path, token string, payload any) contractResponse {
	t.Helper()

	var body io.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		require.NoError(t, err)
		body = bytes.NewReader(b)
	}
	return h.do(t, method, path, token, body)
}

func (h *contractHarness) requestRaw(t *testing.T, method, path, token, raw string) contractResponse {
	t.Helper()
	return h.do(t, method, path, token, strings.NewReader(raw))
}

func (h *contractHarness) do(t *testing.T, method, path, token string, body io.Reader) contractResponse {
	t.Helper()

	req := httptest.NewRequest(method, path, body)
	req.RemoteAddr = h.remote
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	w := httptest.NewRecorder()
	h.handler.ServeHTTP(w, req)

	raw := w.Body.String()
	var decoded map[string]any
	if w.Body.Len() > 0 {
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &decoded), raw)
	}
	return contractResponse{status: w.Code, body: decoded, raw: raw}
}

func (h *contractHarness) cleanupEventUserProblem(eventID, email, slug string) {
	_, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM extension_events WHERE idempotency_key = $1`, eventID)
	h.cleanupUser(email)
	_, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM problems WHERE external_slug = $1`, slug)
}

func (h *contractHarness) cleanupUser(email string) {
	_, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM users WHERE email = $1`, email)
}

func (h *contractHarness) deleteRefreshTokens(tokens ...string) {
	for _, token := range tokens {
		if token == "" {
			continue
		}
		sum := sha256.Sum256([]byte(token))
		_, _ = h.rdb.Client.Del(h.ctx, "auth:refresh:"+hex.EncodeToString(sum[:])).Result()
	}
}

func requireSuccessEnvelope(t *testing.T, resp contractResponse, status int) map[string]any {
	t.Helper()

	require.Equal(t, status, resp.status, resp.raw)
	require.NotContains(t, resp.body, "error", resp.raw)
	data, ok := resp.body["data"].(map[string]any)
	require.True(t, ok, "expected object data envelope, got %T: %s", resp.body["data"], resp.raw)
	return data
}

func requireErrorEnvelope(t *testing.T, resp contractResponse, status int, code string) map[string]any {
	t.Helper()

	require.Equal(t, status, resp.status, resp.raw)
	require.NotContains(t, resp.body, "data", resp.raw)
	errBody := objectField(t, resp.body, "error")
	require.Equal(t, code, stringField(t, errBody, "code"), resp.raw)
	require.NotEmpty(t, stringField(t, errBody, "message"), resp.raw)
	return errBody
}

func tokensFromData(t *testing.T, data map[string]any) contractTokens {
	t.Helper()

	tokens := objectField(t, data, "tokens")
	return contractTokens{
		access:  stringField(t, tokens, "access_token"),
		refresh: stringField(t, tokens, "refresh_token"),
	}
}

func objectField(t *testing.T, obj map[string]any, name string) map[string]any {
	t.Helper()

	value, ok := obj[name].(map[string]any)
	require.True(t, ok, "expected %q object, got %T", name, obj[name])
	return value
}

func stringField(t *testing.T, obj map[string]any, name string) string {
	t.Helper()

	value, ok := obj[name].(string)
	require.True(t, ok, "expected %q string, got %T", name, obj[name])
	return value
}

func boolField(t *testing.T, obj map[string]any, name string) bool {
	t.Helper()

	value, ok := obj[name].(bool)
	require.True(t, ok, "expected %q bool, got %T", name, obj[name])
	return value
}

func int64Field(t *testing.T, obj map[string]any, name string) int64 {
	t.Helper()

	value, ok := obj[name].(float64)
	require.True(t, ok, "expected %q number, got %T", name, obj[name])
	return int64(value)
}

func timeField(t *testing.T, obj map[string]any, name string) time.Time {
	t.Helper()

	value := stringField(t, obj, name)
	ts, err := time.Parse(time.RFC3339, value)
	require.NoError(t, err)
	return ts
}

// requireQueueEnvelope asserts the flat list envelope of GET /me/reviews/queue
// ({"data": [...], "meta": {...}}) and returns the review items.
func requireQueueEnvelope(t *testing.T, resp contractResponse, status int) []any {
	t.Helper()

	require.Equal(t, status, resp.status, resp.raw)
	require.NotContains(t, resp.body, "error", resp.raw)
	items, ok := resp.body["data"].([]any)
	require.True(t, ok, "expected array data envelope, got %T: %s", resp.body["data"], resp.raw)
	return items
}

func findReviewByTitle(t *testing.T, items []any, title string) map[string]any {
	t.Helper()

	for _, raw := range items {
		item, ok := raw.(map[string]any)
		require.True(t, ok, "expected queue item object, got %T", raw)
		if stringField(t, item, "title") == title {
			return item
		}
	}
	t.Fatalf("review titled %q not found in queue: %+v", title, items)
	return nil
}

func requireNoReviewID(t *testing.T, items []any, reviewID int64) {
	t.Helper()

	for _, raw := range items {
		item, ok := raw.(map[string]any)
		require.True(t, ok, "expected queue item object, got %T", raw)
		require.NotEqual(t, reviewID, int64Field(t, item, "id"), "review should have left the due queue")
	}
}

func eventPayload(suffix string, occurredAt time.Time) map[string]any {
	return eventPayloadFor("evt-"+suffix, "contract-"+suffix, "Contract "+suffix, occurredAt, "normal")
}

func eventPayloadFor(eventID, slug, title string, occurredAt time.Time, rating string) map[string]any {
	return map[string]any{
		"eventId":          eventID,
		"source":           "leetcode",
		"event":            "problem_solved",
		"occurredAt":       occurredAt.UTC().Format(time.RFC3339),
		"rating":           rating,
		"extensionVersion": "integration-test",
		"problem": map[string]any{
			"externalId": slug,
			"title":      title,
			"url":        "https://leetcode.com/problems/" + slug + "/",
			"difficulty": "easy",
		},
	}
}

func signedAccessToken(t *testing.T, userID int64, issuedAt time.Time, ttl time.Duration) string {
	t.Helper()

	claims := jwt.RegisteredClaims{
		Issuer:    "freeburger",
		Subject:   strconv.FormatInt(userID, 10),
		IssuedAt:  jwt.NewNumericDate(issuedAt),
		ExpiresAt: jwt.NewNumericDate(issuedAt.Add(ttl)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(contractJWTSecret))
	require.NoError(t, err)
	return signed
}

func uniqueEmail(prefix string) string {
	return "contract-" + uniqueSuffix(prefix) + "@example.test"
}

func uniqueSuffix(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

func nextRemoteAddr() string {
	n := remoteAddrCounter.Add(1)
	return fmt.Sprintf("198.51.%d.%d:12345", 100+(n/200)%50, 1+n%200)
}
