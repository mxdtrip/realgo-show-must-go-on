package server

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	v1 "github.com/mxdtrip/freeburger/services/api/internal/controller/v1"
	"github.com/mxdtrip/freeburger/services/api/internal/extension"
	"github.com/mxdtrip/freeburger/services/api/internal/patterns"
	"github.com/mxdtrip/freeburger/services/api/internal/repo"
	"github.com/mxdtrip/freeburger/services/api/internal/reviews"
	"github.com/mxdtrip/freeburger/services/api/internal/roadmaps"
	"github.com/mxdtrip/freeburger/services/api/internal/scheduler"
	"github.com/mxdtrip/freeburger/services/api/internal/service"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/redis"
)

const requestTimeout = 30 * time.Second

// Deps are the dependencies required to build the HTTP handler.
type Deps struct {
	Logger   *slog.Logger
	Postgres *postgres.Storage
	Redis    *redis.Storage
	Auth     *auth.Service
}

// New builds the application's HTTP handler with the base middleware stack,
// liveness/readiness probes and the versioned API subrouter.
func New(deps Deps) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	// RealIP is intentionally NOT used: the auth rate limiter derives the client
	// IP via clientIP(), which only trusts X-Forwarded-For from known proxies.
	// chi's RealIP would overwrite RemoteAddr from client-supplied headers and
	// let an attacker rotate the rate-limit key by spoofing X-Forwarded-For.
	r.Use(requestLogger(deps.Logger))
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(requestTimeout))

	health := &healthHandler{pg: deps.Postgres, redis: deps.Redis}
	r.Get("/healthz", health.live)
	r.Get("/readyz", health.ready)

	// Старый модуль reviews (для обратной совместимости)
	reviewsSvc := reviews.NewService(reviews.NewRepository(deps.Postgres.Pool), deps.Logger)
	reviewsHandler := reviews.NewHandler(reviewsSvc, deps.Logger)

	// Новый слоистый reviews
	reviewRepo := repo.NewReviewRepository(deps.Postgres.Pool)
	reviewService := service.NewReviewService(reviewRepo, deps.Logger)
	reviewHandler := v1.NewReviewHandler(reviewService)

	patternsHandler := patterns.NewHandler(patterns.NewRepository(deps.Postgres.Pool))
	roadmapsHandler := roadmaps.NewHandler(roadmaps.NewRepository(deps.Postgres.Pool))

	// Browser-extension ingest: simple fixed-interval scheduler (issue #17)
	// behind the Scheduler interface, swappable for FSRS later.
	extensionSvc := extension.NewService(extension.NewRepository(deps.Postgres.Pool), scheduler.NewSimple())
	extensionHandler := extension.NewHandler(extensionSvc)
	extensionStatusHandler := extension.NewStatusHandler(extension.NewStatusService(extension.NewStatusRepository(deps.Postgres.Pool)))

	r.Route("/api/v1", func(r chi.Router) {
		ah := &authHandler{svc: deps.Auth}
		authRateLimit := rateLimit(deps.Redis, "auth", 20, time.Minute)
		r.Route("/auth", func(r chi.Router) {
			r.With(authRateLimit).Post("/register", ah.register)
			r.With(authRateLimit).Post("/login", ah.login)
			r.With(authRateLimit).Post("/refresh", ah.refresh)
			r.Post("/logout", ah.logout)
		})
		r.Route("/users", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Get("/me", ah.me)
		})

		r.Route("/reviews", func(r chi.Router) {
			// Старый модуль (для обратной совместимости)
			reviews.RegisterRoutes(r, reviewsHandler)
		})

		// Новые endpoints согласно контракту
		r.Route("/me/reviews", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				v1.RegisterReviewRoutes(r, reviewHandler)
			})
		})

		r.Route("/extension", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				extension.RegisterRoutes(r, extensionHandler)
			})
		})
		r.With(requireAuth(deps.Auth)).Get("/me/extension/status", extensionStatusHandler.GetStatus) // codex/s3-ext-status

		r.Route("/patterns", func(r chi.Router) {
			patterns.RegisterRoutes(r, patternsHandler)
		})
		r.Route("/roadmaps", func(r chi.Router) {
			roadmaps.RegisterRoutes(r, roadmapsHandler)
		})
	})

	return r
}
