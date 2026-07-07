package server

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/mxdtrip/freeburger/services/api/internal/ai"
	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/cards"
	"github.com/mxdtrip/freeburger/services/api/internal/companies"
	v1 "github.com/mxdtrip/freeburger/services/api/internal/controller/v1"
	"github.com/mxdtrip/freeburger/services/api/internal/dashboard"
	"github.com/mxdtrip/freeburger/services/api/internal/extension"
	"github.com/mxdtrip/freeburger/services/api/internal/patterns"
	"github.com/mxdtrip/freeburger/services/api/internal/problemcards"
	"github.com/mxdtrip/freeburger/services/api/internal/problems"
	"github.com/mxdtrip/freeburger/services/api/internal/quiz"
	"github.com/mxdtrip/freeburger/services/api/internal/repo"
	"github.com/mxdtrip/freeburger/services/api/internal/roadmap"
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
	// CardProvisioner optionally triggers AI card generation when a user
	// solves a problem with no existing cards. Nil disables generation
	// (e.g. no AI provider key configured); wiring lives in cmd/api
	// (production, via config.AI) or tests (a fake provider).
	CardProvisioner extension.Provisioner
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

	// Новый слоистый reviews
	reviewRepo := repo.NewReviewRepository(deps.Postgres.Pool)
	reviewService := service.NewReviewService(reviewRepo, deps.Logger)
	reviewHandler := v1.NewReviewHandler(reviewService)

	patternsHandler := patterns.NewHandler(patterns.NewRepository(deps.Postgres.Pool))
	roadmapHandler := roadmap.NewHandler(roadmap.NewRepository(deps.Postgres.Pool))
	problemsHandler := problems.NewHandler(problems.NewRepository(deps.Postgres.Pool))
	cardsSvc := cards.NewService(cards.NewRepository(deps.Postgres.Pool), reviewService)
	problemCardsHandler := problemcards.NewHandler(problemcards.NewService(problemcards.NewRepository(deps.Postgres.Pool), cardsSvc, deps.Redis))
	roadmapsHandler := roadmaps.NewHandler(roadmaps.NewRepository(deps.Postgres.Pool))
	companiesHandler := companies.NewHandler()
	dashboardHandler := dashboard.NewHandler(dashboard.NewService(dashboard.NewRepository(deps.Postgres.Pool), patterns.NewRepository(deps.Postgres.Pool)))
	cardsHandler := cards.NewHandler(cardsSvc)
	quizRepo := quiz.NewRepository(deps.Postgres.Pool)
	quizSvc := quiz.NewService(quizRepo, reviewService) // reviewService удовлетворяет quiz.ProblemRater (RateByProblemID)
	quizHandler := quiz.NewHandler(quizSvc)
	aiHandler := ai.NewHandler(ai.NewRepository(deps.Postgres.Pool))

	// Browser-extension ingest: FSRS scheduler behind the Scheduler interface,
	// sharing the same algorithm as the review service (issue #160).
	extensionSvc := extension.NewService(extension.NewRepository(deps.Postgres.Pool, scheduler.NewFSRSAdapter()))
	if deps.CardProvisioner != nil {
		extensionSvc = extensionSvc.WithProvisioner(deps.CardProvisioner)
	}
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
		r.With(requireAuth(deps.Auth)).Get("/me", ah.me)
		r.With(requireAuth(deps.Auth)).Patch("/me/profile", ah.patchProfile)
		r.With(requireAuth(deps.Auth)).Patch("/me/notification-settings", ah.patchNotificationSettings)
		r.With(requireAuth(deps.Auth)).Post("/me/export", ah.postExport)
		r.With(requireAuth(deps.Auth)).Delete("/me", ah.deleteMe)
		r.Route("/users", func(r chi.Router) {
			// Backward-compatible alias. New clients should call GET /api/v1/me.
			r.With(requireAuth(deps.Auth)).Get("/me", ah.me)
		})

		r.Route("/me/reviews", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				v1.RegisterReviewRoutes(r, reviewHandler)
			})
		})
		r.Route("/me/patterns", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				patterns.RegisterRoutes(r, patternsHandler)
			})
		})
		r.Route("/patterns", func(r chi.Router) {
			// Backward-compatible alias. New clients should call /me/patterns.
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				patterns.RegisterRoutes(r, patternsHandler)
			})
		})

		// S4: personalized roadmap progress and authenticated company suggestions.
		r.With(requireAuth(deps.Auth)).Get("/me/roadmap", roadmapHandler.Get)
		r.With(requireAuth(deps.Auth)).Get("/companies/search", companiesHandler.Search)

		r.Route("/extension", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				extension.RegisterRoutes(r, extensionHandler)
			})
		})
		r.With(requireAuth(deps.Auth)).Get("/me/extension/status", extensionStatusHandler.GetStatus) // codex/s3-ext-status

		// S2 problems.
		r.Route("/me/problems", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				problems.RegisterRoutes(r, problemsHandler)
				problemcards.RegisterRoutes(r, problemCardsHandler)
			})
		})

		r.With(requireAuth(deps.Auth)).Get("/me/dashboard", dashboardHandler.Get) // codex/s1-dashboard

		r.Route("/me/cards", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				cards.RegisterRoutes(r, cardsHandler)
				ai.RegisterCardRoutes(r, aiHandler)
			})
		})

		r.Route("/me/quiz", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				quiz.RegisterRoutes(r, quizHandler)
				ai.RegisterQuizRoutes(r, aiHandler)
			})
		})

		r.Route("/roadmaps", func(r chi.Router) {
			roadmaps.RegisterRoutes(r, roadmapsHandler)
		})
	})

	return r
}
