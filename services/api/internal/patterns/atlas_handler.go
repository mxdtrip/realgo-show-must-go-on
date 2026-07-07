package patterns

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

var ErrCompanyNotFound = errors.New("company not found")

// GetAtlas serves GET /me/patterns/atlas[?company=<code>].
func (h *Handler) GetAtlas(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("patterns: GetAtlas failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	companyCode := r.URL.Query().Get("company")
	atlas, err := h.repo.GetAtlas(r.Context(), userID, companyCode)
	if err != nil {
		if errors.Is(err, ErrCompanyNotFound) {
			slog.Warn("patterns: GetAtlas failed", slog.Any("err", err), slog.String("company", companyCode))
			response.Fail(w, http.StatusNotFound, "not_found", "company has no relevance data")
			return
		}
		slog.Error("patterns: GetAtlas failed", slog.Any("err", err), slog.Int64("user_id", userID))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not load pattern atlas")
		return
	}

	response.JSON(w, http.StatusOK, atlas)
}

// ListAtlasCompanies serves GET /me/patterns/atlas/companies: companies that
// actually carry relevance evidence (never an invented list).
func (h *Handler) ListAtlasCompanies(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.UserIDFromContext(r.Context()); !ok {
		slog.Warn("patterns: ListAtlasCompanies failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	companies, err := h.repo.ListCompanies(r.Context())
	if err != nil {
		slog.Error("patterns: ListAtlasCompanies failed", slog.Any("err", err))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not list companies")
		return
	}

	response.JSON(w, http.StatusOK, map[string][]AtlasCompany{"companies": companies})
}

// GetAtlasNode serves GET /me/patterns/atlas/{code}: the educational detail
// view of a taxonomy node (family or subpattern).
func (h *Handler) GetAtlasNode(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		slog.Warn("patterns: GetAtlasNode failed")
		response.Fail(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	code := chi.URLParam(r, "code")
	detail, err := h.repo.GetAtlasNode(r.Context(), userID, code)
	if err != nil {
		if errors.Is(err, ErrPatternNotFound) {
			slog.Warn("patterns: GetAtlasNode failed", slog.Any("err", err), slog.String("code", code))
			response.Fail(w, http.StatusNotFound, "not_found", "pattern not found")
			return
		}
		slog.Error("patterns: GetAtlasNode failed", slog.Any("err", err), slog.String("code", code))
		response.Fail(w, http.StatusInternalServerError, "internal_error", "could not load pattern")
		return
	}

	response.JSON(w, http.StatusOK, detail)
}
