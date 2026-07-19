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
	"github.com/mxdtrip/freeburger/services/api/internal/practice"
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

// The upstream AI client is bounded at 45 seconds. Keep the request context
// slightly longer so synchronous/SSE responses can finish instead of being
// cancelled by middleware first.
const requestTimeout = 60 * time.Second

// Deps are the dependencies required to build the HTTP handler.
type Deps struct {
	Logger   *slog.Logger
	Postgres *postgres.Storage
	Redis    *redis.Storage
	Auth     *auth.Service
	// Scheduler is the single FSRS scheduler shared by every code path that
	// plans a review (extension ingest, manual review-rate, card-rate,
	// quiz-rate). Created once in app.Run from config.FSRS so that one set of
	// parameters governs all scheduling; see the FSRS audit A1+A2.
	// When nil, server.New falls back to scheduler.NewFSRSAdapter() (default
	// parameters) to keep wiring tests simple.
	Scheduler scheduler.Scheduler
	// CardProvisioner optionally triggers AI card generation when a user
	// solves a problem with no existing cards, and backs POST
	// /me/cards/generate's manual trigger. Nil disables generation (e.g. no
	// AI provider key configured); wiring lives in cmd/api (production, via
	// config.AI) or tests (a fake provider). Concrete type (not an
	// interface): a nil *ai.Provisioner boxed into an interface parameter
	// would no longer compare equal to nil, so call sites below check this
	// field directly before handing it to code that takes an interface.
	CardProvisioner *ai.Provisioner
	// AssistantProvider optionally serves guided extension hints. Nil keeps the
	// route mounted but returns 503, so clients can show a friendly disabled
	// state without learning anything about secrets/config.
	AssistantProvider ai.HintProvider
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

	// Single FSRS scheduler shared by every scheduling path. When the caller
	// didn't supply one (e.g. legacy integration tests), fall back to the
	// default-parameter adapter so the wiring still works.
	sched := deps.Scheduler
	if sched == nil {
		sched = scheduler.NewFSRSAdapter()
	}

	// Новый слоистый reviews
	reviewRepo := repo.NewReviewRepository(deps.Postgres.Pool)
	reviewService := service.NewReviewService(reviewRepo, sched, deps.Logger)
	reviewHandler := v1.NewReviewHandler(reviewService)

	patternsHandler := patterns.NewHandler(patterns.NewRepository(deps.Postgres.Pool))
	roadmapHandler := roadmap.NewHandler(roadmap.NewRepository(deps.Postgres.Pool))
	problemsHandler := problems.NewHandler(problems.NewRepository(deps.Postgres.Pool))
	cardsSvc := cards.NewService(cards.NewRepository(deps.Postgres.Pool), reviewService)
	problemCardsHandler := problemcards.NewHandler(problemcards.NewService(problemcards.NewRepository(deps.Postgres.Pool), cardsSvc, deps.Redis))
	roadmapsHandler := roadmaps.NewHandler(roadmaps.NewRepository(deps.Postgres.Pool))
	companiesHandler := companies.NewHandler(companies.NewRepository(deps.Postgres.Pool))
	dashboardHandler := dashboard.NewHandler(dashboard.NewService(dashboard.NewRepository(deps.Postgres.Pool), patterns.NewRepository(deps.Postgres.Pool)))
	cardsHandler := cards.NewHandler(cardsSvc)
	practiceHandler := practice.NewHandler(practice.NewRepository(deps.Postgres.Pool))
	quizRepo := quiz.NewRepository(deps.Postgres.Pool)
	quizSvc := quiz.NewService(quizRepo, reviewService) // reviewService удовлетворяет quiz.ProblemRater (RateByProblemID)
	quizHandler := quiz.NewHandler(quizSvc)
	// deps.CardProvisioner is a concrete *ai.Provisioner; boxing a nil one
	// straight into the ai.CardGenerator interface parameter would produce a
	// non-nil interface wrapping a nil pointer, so nil is only ever handed
	// off explicitly here (see the CardProvisioner field doc).
	var cardGenerator ai.CardGenerator
	if deps.CardProvisioner != nil {
		cardGenerator = deps.CardProvisioner
	}
	aiHandler := ai.NewHandler(ai.NewRepository(deps.Postgres.Pool), cardGenerator)
	assistantHandler := ai.NewAssistantHandler(ai.NewRepository(deps.Postgres.Pool), deps.AssistantProvider)

	// Browser-extension ingest: FSRS scheduler behind the Scheduler interface,
	// sharing the same algorithm (and the same instance) as the review service
	// (issue #160, FSRS audit A1).
	extensionSvc := extension.NewService(extension.NewRepository(deps.Postgres.Pool, sched))
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
			r.With(requireAuth(deps.Auth), authRateLimit).Post("/device-session", ah.deviceSession)
			r.Post("/logout", ah.logout)
		})
		r.With(requireAuth(deps.Auth)).Get("/me", ah.me)
		r.With(requireAuth(deps.Auth)).Patch("/me/profile", ah.patchProfile)
		r.With(requireAuth(deps.Auth)).Patch("/me/notification-settings", ah.patchNotificationSettings)
		r.With(requireAuth(deps.Auth)).Post("/me/password", ah.changePassword)
		r.With(requireAuth(deps.Auth)).Post("/me/sessions/revoke", ah.revokeAllSessions)
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
			extensionRateLimit := rateLimit(deps.Redis, "extension", 120, time.Minute)
			r.With(requireAuth(deps.Auth), extensionRateLimit).Group(func(r chi.Router) {
				extension.RegisterRoutes(r, extensionHandler)
			})
		})
		r.With(requireAuth(deps.Auth)).Get("/me/extension/status", extensionStatusHandler.GetStatus) // codex/s3-ext-status

		assistantRateLimit := rateLimit(deps.Redis, "assistant", 30, time.Minute)
		r.Route("/assistant", func(r chi.Router) {
			r.With(requireAuth(deps.Auth), assistantRateLimit).Group(func(r chi.Router) {
				ai.RegisterAssistantRoutes(r, assistantHandler)
			})
		})

		// S2 problems.
		r.Route("/me/problems", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				problems.RegisterRoutes(r, problemsHandler)
				problemcards.RegisterRoutes(r, problemCardsHandler)
			})
		})

		r.With(requireAuth(deps.Auth)).Get("/me/dashboard", dashboardHandler.Get) // codex/s1-dashboard

		r.Route("/me/practice", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				practice.RegisterRoutes(r, practiceHandler)
			})
		})

		r.Route("/me/cards", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				cards.RegisterRoutes(r, cardsHandler)
				ai.RegisterCardRoutes(r.With(rateLimit(deps.Redis, "card-generation", 10, time.Minute)), aiHandler)
			})
		})

		r.Route("/me/quiz", func(r chi.Router) {
			r.With(requireAuth(deps.Auth)).Group(func(r chi.Router) {
				quiz.RegisterRoutes(r, quizHandler)
				ai.RegisterQuizRoutes(r.With(rateLimit(deps.Redis, "quiz-generation", 10, time.Minute)), aiHandler)
			})
		})

		r.Route("/roadmaps", func(r chi.Router) {
			roadmaps.RegisterRoutes(r, roadmapsHandler)
		})
	})

	return r
}
