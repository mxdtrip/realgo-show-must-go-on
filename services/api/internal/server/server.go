package server

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/redis"
)

const requestTimeout = 30 * time.Second

// Deps are the dependencies required to build the HTTP handler.
type Deps struct {
	Logger   *slog.Logger
	Postgres *postgres.Storage
	Redis    *redis.Storage
}

// New builds the application's HTTP handler with the base middleware stack,
// liveness/readiness probes and the versioned API subrouter.
func New(deps Deps) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(requestLogger(deps.Logger))
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(requestTimeout))

	health := &healthHandler{pg: deps.Postgres, redis: deps.Redis}
	r.Get("/healthz", health.live)
	r.Get("/readyz", health.ready)

	r.Route("/api/v1", func(r chi.Router) {
		// Domain routes (auth, extension events, reviews, dashboard, ...) are
		// mounted here in their own pull requests.
	})

	return r
}
