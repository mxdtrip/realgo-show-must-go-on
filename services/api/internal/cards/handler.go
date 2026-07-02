package cards

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

const (
	defaultListLimit    = 50
	defaultSessionLimit = 20
	maxLimit            = 100
)

var (
	errInvalidCursor = errors.New("invalid cursor")
	errInvalidLimit  = errors.New("limit must be a positive integer")
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/", h.List)
	r.Post("/", h.Create)
	r.Get("/session", h.Session)
	r.Get("/{cardId}", h.Get)
	r.Patch("/{cardId}", h.Update)
	r.Delete("/{cardId}", h.Delete)
	r.Post("/{cardId}/rate", h.Rate)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	params, err := parseListParams(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	items, nextCursor, err := h.svc.List(r.Context(), userID, params)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load cards")
		return
	}

	response.JSONWithMeta(w, http.StatusOK, items, ListMeta{NextCursor: nextCursor})
}

func (h *Handler) Session(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	params, err := parseSessionParams(r)
	if err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	session, err := h.svc.Session(r.Context(), userID, params)
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not load card session")
		return
	}

	response.JSON(w, http.StatusOK, session)
}

func (h *Handler) Rate(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	cardID, err := strconv.ParseInt(chi.URLParam(r, "cardId"), 10, 64)
	if err != nil || cardID <= 0 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid cardId")
		return
	}

	var req RateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}

	result, err := h.svc.Rate(r.Context(), userID, cardID, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrCardNotFound):
			response.Fail(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		case errors.Is(err, ErrInvalidRating):
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		case strings.HasPrefix(err.Error(), "invalid reviewedAt"):
			response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		default:
			response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not rate card")
		}
		return
	}

	response.JSON(w, http.StatusOK, result)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	var req createCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if !validCardType(req.Type) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "type must be pattern_recognition, algorithm_mechanics, or edge_case")
		return
	}
	if req.Question == "" || req.Answer == "" {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "question and answer are required")
		return
	}
	if req.ProblemID != nil && req.PatternID != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "only one of problem_id or pattern_id may be set")
		return
	}

	card, err := h.svc.Create(r.Context(), userID, CreateCardInput{
		Type:        req.Type,
		Question:    req.Question,
		Answer:      req.Answer,
		Explanation: req.Explanation,
		Source:      req.Source,
		ProblemID:   req.ProblemID,
		PatternID:   req.PatternID,
	})
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not create card")
		return
	}

	response.JSON(w, http.StatusCreated, card)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	cardID, err := strconv.ParseInt(chi.URLParam(r, "cardId"), 10, 64)
	if err != nil || cardID <= 0 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid cardId")
		return
	}

	card, err := h.svc.GetByID(r.Context(), userID, cardID)
	if errors.Is(err, ErrCardNotFound) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "card not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not fetch card")
		return
	}

	response.JSON(w, http.StatusOK, card)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	cardID, err := strconv.ParseInt(chi.URLParam(r, "cardId"), 10, 64)
	if err != nil || cardID <= 0 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid cardId")
		return
	}

	var req updateCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.Type != nil && !validCardType(*req.Type) {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "type must be pattern_recognition, algorithm_mechanics, or edge_case")
		return
	}

	card, err := h.svc.Update(r.Context(), userID, cardID, UpdateCardInput{
		Type:        req.Type,
		Question:    req.Question,
		Answer:      req.Answer,
		Explanation: req.Explanation,
		Source:      req.Source,
	})
	if errors.Is(err, ErrCardNotFound) {
		response.Fail(w, http.StatusNotFound, "NOT_FOUND", "card not found")
		return
	}
	if err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not update card")
		return
	}

	response.JSON(w, http.StatusOK, card)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated")
		return
	}

	cardID, err := strconv.ParseInt(chi.URLParam(r, "cardId"), 10, 64)
	if err != nil || cardID <= 0 {
		response.Fail(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid cardId")
		return
	}

	if err := h.svc.Delete(r.Context(), userID, cardID); err != nil {
		response.Fail(w, http.StatusInternalServerError, "INTERNAL_ERROR", "could not delete card")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func parseListParams(r *http.Request) (ListParams, error) {
	limit, err := parseLimit(r.URL.Query().Get("limit"), defaultListLimit)
	if err != nil {
		return ListParams{}, err
	}

	cardType := strings.TrimSpace(r.URL.Query().Get("type"))
	if cardType != "" && !validCardType(cardType) {
		return ListParams{}, errors.New("type must be one of pattern_recognition, algorithm_mechanics, edge_case")
	}

	cursor := initialCursor()
	if raw := strings.TrimSpace(r.URL.Query().Get("cursor")); raw != "" {
		cursor, err = decodeCursor(raw)
		if err != nil {
			return ListParams{}, err
		}
	}

	return ListParams{
		Limit:    int32(limit + 1),
		Type:     cardType,
		Cursor:   cursor,
		PageSize: limit,
	}, nil
}

func parseSessionParams(r *http.Request) (SessionParams, error) {
	limit, err := parseLimit(r.URL.Query().Get("limit"), defaultSessionLimit)
	if err != nil {
		return SessionParams{}, err
	}

	scope := strings.TrimSpace(r.URL.Query().Get("scope"))
	if scope == "" {
		scope = SessionScopeDue
	}
	if !validScope(scope) {
		return SessionParams{}, errors.New("scope must be due, hard_normal, or all")
	}

	return SessionParams{Scope: scope, Limit: int32(limit)}, nil
}

func parseLimit(raw string, defaultValue int) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return defaultValue, nil
	}
	limit, err := strconv.Atoi(raw)
	if err != nil || limit <= 0 {
		return 0, errInvalidLimit
	}
	if limit > maxLimit {
		return maxLimit, nil
	}
	return limit, nil
}

func validCardType(value string) bool {
	switch value {
	case CardTypePatternRecognition, CardTypeAlgorithmMechanics, CardTypeEdgeCase:
		return true
	default:
		return false
	}
}

func validScope(value string) bool {
	switch value {
	case SessionScopeDue, SessionScopeHardNormal, SessionScopeAll:
		return true
	default:
		return false
	}
}

type cursorPayload struct {
	CreatedAt string `json:"createdAt"`
	ID        int64  `json:"id"`
}

func initialCursor() Cursor {
	return Cursor{
		CreatedAt: time.Date(9999, 12, 31, 23, 59, 59, int(time.Second-time.Nanosecond), time.UTC),
		ID:        math.MaxInt64,
	}
}

func encodeCursor(cursor Cursor) string {
	payload := cursorPayload{
		CreatedAt: cursor.CreatedAt.UTC().Format(time.RFC3339Nano),
		ID:        cursor.ID,
	}
	raw, _ := json.Marshal(payload)
	return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeCursor(raw string) (Cursor, error) {
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return Cursor{}, errInvalidCursor
	}

	var payload cursorPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return Cursor{}, errInvalidCursor
	}
	if payload.ID <= 0 || strings.TrimSpace(payload.CreatedAt) == "" {
		return Cursor{}, errInvalidCursor
	}

	createdAt, err := time.Parse(time.RFC3339Nano, payload.CreatedAt)
	if err != nil {
		return Cursor{}, errInvalidCursor
	}
	return Cursor{CreatedAt: createdAt, ID: payload.ID}, nil
}
