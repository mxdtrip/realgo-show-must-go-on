package server

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/server/response"
)

// requireAuth authenticates the request via a Bearer access token and stores the
// user id in the request context. Unauthenticated requests get a 401 envelope.
func requireAuth(svc *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if svc == nil {
				slog.Error("server: requireAuth failed", slog.String("reason", "auth service unavailable"))
				response.Fail(w, http.StatusServiceUnavailable, "auth_unavailable", "authentication service is not configured")
				return
			}
			token, ok := bearerToken(r)
			if !ok {
				slog.Warn("server: requireAuth failed", slog.String("reason", "missing bearer token"))
				response.Fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing bearer token")
				return
			}
			userID, err := svc.ParseAccessToken(token)
			if err != nil {
				slog.Warn("server: requireAuth failed", slog.Any("err", err))
				response.Fail(w, http.StatusUnauthorized, "INVALID_TOKEN", "invalid or expired token")
				return
			}
			ctx := auth.ContextWithUserID(r.Context(), userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func bearerToken(r *http.Request) (string, bool) {
	const prefix = "Bearer "
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, prefix) {
		return "", false
	}
	token := strings.TrimSpace(header[len(prefix):])
	if token == "" {
		return "", false
	}
	return token, true
}
