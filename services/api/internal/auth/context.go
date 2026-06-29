package auth

import "context"

type contextKey int

const userIDKey contextKey = iota

// ContextWithUserID stores the authenticated user id in the context.
func ContextWithUserID(ctx context.Context, userID int64) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}

// UserIDFromContext returns the authenticated user id, if the request passed
// through the auth middleware.
func UserIDFromContext(ctx context.Context) (int64, bool) {
	id, ok := ctx.Value(userIDKey).(int64)
	return id, ok
}
