package server

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// requestLogger logs one structured line per request once it completes,
// including the request id injected by middleware.RequestID.
//
// It also surfaces the request id as an "X-Request-Id" response header so the
// response layer (which only sees http.ResponseWriter, not the request context)
// can mirror it into the JSON body's meta.requestId, and so clients receive it
// even for non-JSON responses (e.g. the assistant SSE stream, or the empty 504
// body written by middleware.Timeout on deadline).
func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			start := time.Now()

			// Surface the request id as a response header before the handler
			// runs, so it is set well before any WriteHeader call and is
			// visible to every downstream response writer (JSON body, SSE
			// stream, or the bare 504 from middleware.Timeout).
			reqID := middleware.GetReqID(r.Context())
			if reqID != "" {
				ww.Header().Set("X-Request-Id", reqID)
			}

			defer func() {
				logger.Info("http request",
					slog.String("method", r.Method),
					slog.String("path", r.URL.Path),
					slog.Int("status", ww.Status()),
					slog.Int("bytes", ww.BytesWritten()),
					slog.Duration("duration", time.Since(start)),
					slog.String("request_id", reqID),
					slog.String("remote_ip", r.RemoteAddr),
				)
			}()

			next.ServeHTTP(ww, r)
		})
	}
}
