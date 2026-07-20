package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"

	"github.com/mxdtrip/freeburger/services/api/internal/ai"
	"github.com/mxdtrip/freeburger/services/api/internal/auth"
	"github.com/mxdtrip/freeburger/services/api/internal/cards"
	"github.com/mxdtrip/freeburger/services/api/internal/config"
	"github.com/mxdtrip/freeburger/services/api/internal/server"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
	"github.com/mxdtrip/freeburger/services/api/internal/storage/redis"
)

const shutdownTimeout = 10 * time.Second

// Run loads configuration, wires dependencies and serves HTTP until ctx is
// cancelled (SIGINT/SIGTERM), then shuts everything down gracefully.
func Run(ctx context.Context) error {
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("load .env: %w", err)
	}

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	logger := newLogger(cfg.Env)
	slog.SetDefault(logger)
	logger.Info("starting api", slog.String("env", cfg.Env))

	authCfg, err := auth.LoadConfig()
	if err != nil {
		return fmt.Errorf("load auth config: %w", err)
	}

	pg, err := postgres.New(ctx, &cfg.Database)
	if err != nil {
		return fmt.Errorf("connect postgres: %w", err)
	}
	defer pg.Close()
	logger.Info("connected to postgres")

	rdb, err := redis.New(ctx, &cfg.Redis)
	if err != nil {
		return fmt.Errorf("connect redis: %w", err)
	}
	defer func() { _ = rdb.Close() }()
	logger.Info("connected to redis")

	if err := cards.WarmSeedCache(ctx, rdb); err != nil {
		return fmt.Errorf("warm cards seed cache: %w", err)
	}

	authSvc := auth.NewService(db.New(pg.Pool), rdb.Client, authCfg)

	deps := server.Deps{
		Logger:   logger,
		Postgres: pg,
		Redis:    rdb,
		Auth:     authSvc,
	}
	if cfg.Enabled() {
		geminiProvider := ai.NewGeminiProvider(cfg.AI)
		deps.CardProvisioner = ai.NewProvisioner(ai.NewRepository(pg.Pool), rdb, geminiProvider, logger)
		deps.AssistantProvider = geminiProvider
		logger.Info("ai features enabled", slog.String("model", cfg.Model))
	} else {
		// Only reachable startup-time signal that GEMINI_API_KEY didn't reach this
		// container — there's no SSH access to this host from outside the home
		// network, so this line (visible via `docker compose logs api`) is the
		// only way to tell "key missing" apart from "key present but the Gemini
		// call itself failed" without a live request.
		logger.Warn("ai features disabled: GEMINI_API_KEY is not set")
	}

	handler := server.New(deps)

	srv := &http.Server{
		Addr:              cfg.Address,
		Handler:           handler,
		ReadHeaderTimeout: cfg.Timeout,
		ReadTimeout:       cfg.Timeout,
		// A server-wide WriteTimeout cannot distinguish ordinary JSON from
		// long-lived SSE responses. Request/provider deadlines remain bounded
		// at their own layers; leaving this unset prevents valid AI streams
		// from being cut off after the four-second header/body timeout.
		WriteTimeout: 0,
		IdleTimeout:  cfg.IdleTimeout,
	}

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("http server listening", slog.String("address", cfg.Address))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
			return
		}
		serverErr <- nil
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
		logger.Info("shutdown signal received, stopping http server")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}

	logger.Info("api stopped")
	return nil
}

// newLogger returns a human-readable text logger for local development and a
// structured JSON logger everywhere else.
func newLogger(env string) *slog.Logger {
	var handler slog.Handler
	if env == "local" {
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})
	} else {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	}
	return slog.New(handler)
}
