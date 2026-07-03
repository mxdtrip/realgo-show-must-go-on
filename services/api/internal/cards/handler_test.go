package cards

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	reviewresponse "github.com/mxdtrip/freeburger/services/api/internal/controller/v1/response"
)

func TestListRequiresAuth(t *testing.T) {
	h := testHandler(&fakeRepository{}, &fakeRater{})
	req := httptest.NewRequest(http.MethodGet, "/me/cards", nil)
	w := httptest.NewRecorder()

	h.List(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestListRejectsInvalidParams(t *testing.T) {
	tests := []string{
		"/me/cards?type=concept",
		"/me/cards?limit=0",
		"/me/cards?limit=bad",
		"/me/cards?cursor=not-base64",
	}

	for _, target := range tests {
		h := testHandler(&fakeRepository{}, &fakeRater{})
		req := authenticatedRequest(http.MethodGet, target, nil, 42)
		w := httptest.NewRecorder()

		h.List(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("%s: expected 400, got %d", target, w.Code)
		}
	}
}

func TestListReturnsTopLevelDataAndMeta(t *testing.T) {
	created1 := time.Date(2026, 7, 2, 10, 0, 0, 0, time.UTC)
	created2 := created1.Add(-time.Minute)
	created3 := created2.Add(-time.Minute)
	repo := &fakeRepository{list: []CardRecord{
		{ID: 3, Type: CardTypePatternRecognition, Question: "front 3", Answer: "back 3", CreatedAt: created1, SourceEntityType: "custom", SourceLabel: "custom card"},
		{ID: 2, Type: CardTypeEdgeCase, Question: "front 2", Answer: "back 2", CreatedAt: created2, SourceEntityType: "custom", SourceLabel: "custom card"},
		{ID: 1, Type: CardTypeAlgorithmMechanics, Question: "front 1", Answer: "back 1", CreatedAt: created3, SourceEntityType: "custom", SourceLabel: "custom card"},
	}}
	h := testHandler(repo, &fakeRater{})
	req := authenticatedRequest(http.MethodGet, "/me/cards?limit=2&type=edge_case", nil, 42)
	w := httptest.NewRecorder()

	h.List(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if repo.listParams.Limit != 3 || repo.listParams.PageSize != 2 {
		t.Fatalf("limit/page size = %d/%d, want 3/2", repo.listParams.Limit, repo.listParams.PageSize)
	}
	if repo.listParams.Type != CardTypeEdgeCase {
		t.Fatalf("type = %q", repo.listParams.Type)
	}

	var body struct {
		Data []Card   `json:"data"`
		Meta ListMeta `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if len(body.Data) != 2 {
		t.Fatalf("expected 2 visible cards, got %d", len(body.Data))
	}
	if body.Meta.NextCursor == nil {
		t.Fatal("nextCursor must be present when another page exists")
	}
	cursor, err := decodeCursor(*body.Meta.NextCursor)
	if err != nil {
		t.Fatalf("nextCursor must decode: %v", err)
	}
	if !cursor.CreatedAt.Equal(created2) || cursor.ID != 2 {
		t.Fatalf("cursor = (%s,%d), want (%s,2)", cursor.CreatedAt, cursor.ID, created2)
	}
}

func TestSessionRejectsInvalidScope(t *testing.T) {
	h := testHandler(&fakeRepository{}, &fakeRater{})
	req := authenticatedRequest(http.MethodGet, "/me/cards/session?scope=late", nil, 42)
	w := httptest.NewRecorder()

	h.Session(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestSessionReturnsPayload(t *testing.T) {
	next := time.Date(2026, 7, 3, 10, 0, 0, 0, time.UTC)
	repo := &fakeRepository{session: []CardRecord{
		{
			ID: 10, Type: CardTypePatternRecognition, Question: "front", Answer: "back",
			CreatedAt: time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC), SourceLabel: "Two Sum",
			NextReviewAt: &next, ReviewCount: 2,
		},
	}}
	h := testHandler(repo, &fakeRater{})
	req := authenticatedRequest(http.MethodGet, "/me/cards/session?scope=all&limit=5", nil, 42)
	w := httptest.NewRecorder()

	h.Session(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if repo.sessionParams.Scope != SessionScopeAll || repo.sessionParams.Limit != 5 {
		t.Fatalf("scope/limit = %q/%d", repo.sessionParams.Scope, repo.sessionParams.Limit)
	}

	var body struct {
		Data Session `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if !strings.HasPrefix(body.Data.SessionID, "crs_") {
		t.Fatalf("sessionId = %q, want crs_ prefix", body.Data.SessionID)
	}
	if len(body.Data.Cards) != 1 || body.Data.Cards[0].ReviewState.Attempts != 2 {
		t.Fatalf("unexpected cards payload: %+v", body.Data.Cards)
	}
}

func TestListCapturesPatternCode(t *testing.T) {
	repo := &fakeRepository{}
	h := testHandler(repo, &fakeRater{})
	req := authenticatedRequest(http.MethodGet, "/me/cards?patternCode=two_pointers", nil, 42)
	w := httptest.NewRecorder()

	h.List(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if repo.listParams.PatternCode != "two_pointers" {
		t.Fatalf("patternCode = %q, want two_pointers", repo.listParams.PatternCode)
	}
}

func TestSessionCapturesPatternCode(t *testing.T) {
	repo := &fakeRepository{}
	h := testHandler(repo, &fakeRater{})
	req := authenticatedRequest(http.MethodGet, "/me/cards/session?scope=all&patternCode=sliding_window", nil, 42)
	w := httptest.NewRecorder()

	h.Session(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if repo.sessionParams.PatternCode != "sliding_window" {
		t.Fatalf("patternCode = %q, want sliding_window", repo.sessionParams.PatternCode)
	}
}

func TestRateValidatesRequest(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "bad rating", body: `{"rating":"bad","reviewedAt":"2026-07-02T10:00:00Z"}`},
		{name: "bad reviewedAt", body: `{"rating":"normal","reviewedAt":"today"}`},
	}

	for _, tt := range tests {
		h := testHandler(&fakeRepository{}, &fakeRater{})
		req := authenticatedRequest(http.MethodPost, "/me/cards/7/rate", strings.NewReader(tt.body), 42)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		routeHandler(h).ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("%s: expected 400, got %d: %s", tt.name, w.Code, w.Body.String())
		}
	}
}

func TestRateDelegatesToReviewRater(t *testing.T) {
	reviewedAt := time.Date(2026, 7, 2, 10, 0, 0, 0, time.UTC)
	next := reviewedAt.Add(24 * time.Hour)
	repo := &fakeRepository{scheduleID: 99, attemptCount: 1}
	rater := &fakeRater{nextReviewAt: next}
	h := testHandler(repo, rater)
	req := authenticatedRequest(http.MethodPost, "/me/cards/7/rate", strings.NewReader(`{
		"sessionId":"crs_eyJ0b3RhbCI6MX0",
		"rating":"hard",
		"reviewedAt":"2026-07-02T10:00:00Z"
	}`), 42)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	routeHandler(h).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if repo.ensureCardID != 7 || repo.ensureUserID != 42 {
		t.Fatalf("ensure card/user = %d/%d, want 7/42", repo.ensureCardID, repo.ensureUserID)
	}
	if rater.reviewID != 99 || rater.userID != 42 || rater.rating != "hard" {
		t.Fatalf("rate args = review %d user %d rating %q", rater.reviewID, rater.userID, rater.rating)
	}

	var body struct {
		Data RateResult `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if !body.Data.RepeatInCurrentSession {
		t.Fatal("hard rating should repeat in current session")
	}
	if body.Data.SessionProgress.Remaining != 1 {
		t.Fatalf("remaining = %d, want 1", body.Data.SessionProgress.Remaining)
	}
}

func TestCreateMapsMissingTargetToBadRequest(t *testing.T) {
	h := testHandler(&fakeRepository{createErr: ErrCardTargetNotFound}, &fakeRater{})
	req := authenticatedRequest(http.MethodPost, "/me/cards", strings.NewReader(`{
		"type":"edge_case",
		"question":"front",
		"answer":"back",
		"problem_id":999
	}`), 42)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.Create(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteMapsMissingCardToNotFound(t *testing.T) {
	h := testHandler(&fakeRepository{deleteErr: ErrCardNotFound}, &fakeRater{})
	req := authenticatedRequest(http.MethodDelete, "/me/cards/999", nil, 42)
	w := httptest.NewRecorder()

	routeHandler(h).ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func testHandler(repo *fakeRepository, rater *fakeRater) *Handler {
	svc := NewService(repo, rater)
	svc.now = func() time.Time { return time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC) }
	return NewHandler(svc)
}

func routeHandler(h *Handler) http.Handler {
	r := chi.NewRouter()
	r.Route("/me/cards", func(r chi.Router) {
		RegisterRoutes(r, h)
	})
	return r
}

func authenticatedRequest(method, target string, body *strings.Reader, userID int64) *http.Request {
	var reader *strings.Reader
	if body == nil {
		reader = strings.NewReader("")
	} else {
		reader = body
	}
	req := httptest.NewRequest(method, target, reader)
	return req.WithContext(auth.ContextWithUserID(req.Context(), userID))
}

type fakeRepository struct {
	list          []CardRecord
	session       []CardRecord
	createErr     error
	deleteErr     error
	listParams    ListParams
	sessionParams SessionParams
	scheduleID    int64
	attemptCount  int
	ensureUserID  int64
	ensureCardID  int64
}

func (f *fakeRepository) List(_ context.Context, _ int64, params ListParams) ([]CardRecord, error) {
	f.listParams = params
	if f.list == nil {
		return []CardRecord{}, nil
	}
	return f.list, nil
}

func (f *fakeRepository) ListSession(_ context.Context, _ int64, params SessionParams) ([]CardRecord, error) {
	f.sessionParams = params
	if f.session == nil {
		return []CardRecord{}, nil
	}
	return f.session, nil
}

func (f *fakeRepository) EnsureReviewSchedule(_ context.Context, userID, cardID int64, _ time.Time) (int64, error) {
	f.ensureUserID = userID
	f.ensureCardID = cardID
	if f.scheduleID == 0 {
		return 1, nil
	}
	return f.scheduleID, nil
}

func (f *fakeRepository) CountSessionAttempts(context.Context, int64, time.Time) (int, error) {
	return f.attemptCount, nil
}

func (f *fakeRepository) Create(_ context.Context, _ int64, _ CreateCardInput) (CardDetail, error) {
	if f.createErr != nil {
		return CardDetail{}, f.createErr
	}
	return CardDetail{}, nil
}

func (f *fakeRepository) GetByID(_ context.Context, _, _ int64) (CardDetail, error) {
	return CardDetail{}, ErrCardNotFound
}

func (f *fakeRepository) Update(_ context.Context, _, _ int64, _ UpdateCardInput) (CardDetail, error) {
	return CardDetail{}, ErrCardNotFound
}

func (f *fakeRepository) Delete(_ context.Context, _, _ int64) error {
	if f.deleteErr != nil {
		return f.deleteErr
	}
	return nil
}

type fakeRater struct {
	reviewID     int64
	userID       int64
	rating       string
	nextReviewAt time.Time
}

func (f *fakeRater) RateReview(_ context.Context, reviewID, userID int64, rating string, _ time.Time) (reviewresponse.RateReviewData, error) {
	f.reviewID = reviewID
	f.userID = userID
	f.rating = rating
	next := f.nextReviewAt
	if next.IsZero() {
		next = time.Date(2026, 7, 3, 12, 0, 0, 0, time.UTC)
	}
	return reviewresponse.RateReviewData{
		ReviewID:     reviewID,
		Rating:       rating,
		NextReviewAt: next,
		Status:       "completed",
	}, nil
}
