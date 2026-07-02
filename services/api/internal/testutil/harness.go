package testutil

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"
	"github.com/testcontainers/testcontainers-go"
	tcpg "github.com/testcontainers/testcontainers-go/modules/postgres"
	tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/mxdtrip/freeburger/services/api/internal/config"
)

// Harness boots a throwaway Postgres + Redis pair (testcontainers) with the
// project's real migrations applied, for acceptance and integration tests.
//
// Lifecycle: Start once per package in TestMain, reuse across tests, then call
// Stop once after m.Run(). Call Reset at the top of each test for per-test
// isolation. Nothing here is stubbed: every dependency is a real container.
type Harness struct {
	PGContainer testcontainers.Container
	RDContainer *tcredis.RedisContainer

	Pool  *pgxpool.Pool   // pgx pool over the migrated Postgres
	Redis *goredis.Client // live Redis client

	pgCfg config.Database // cached for DatabaseConfig()
	rdCfg config.Redis    // cached for RedisConfig()
}

const (
	pgImage = "postgres:16-alpine" // matches project (CLAUDE.md: PostgreSQL 16)
	pgUser  = "test"
	pgPass  = "test"
	pgDB    = "testdb"
	rdImage = "redis:7-alpine" // matches project (CLAUDE.md: Redis 7)
)

// Start boots both containers, applies all embedded migrations, builds a pgx
// pool, and pings every dependency. The caller MUST call Stop when done
// (typically once, after m.Run()).
func Start(ctx context.Context) (*Harness, error) {
	h := &Harness{}

	pgC, err := tcpg.Run(ctx, pgImage,
		tcpg.WithDatabase(pgDB),
		tcpg.WithUsername(pgUser),
		tcpg.WithPassword(pgPass),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("testutil: start postgres: %w", err)
	}
	h.PGContainer = pgC

	pgURL, err := pgC.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		h.Stop()
		return nil, fmt.Errorf("testutil: postgres connection string: %w", err)
	}

	if err := ApplyMigrations(pgURL); err != nil {
		h.Stop()
		return nil, fmt.Errorf("testutil: apply migrations: %w", err)
	}

	pool, err := pgxpool.New(ctx, pgURL)
	if err != nil {
		h.Stop()
		return nil, fmt.Errorf("testutil: build pgx pool: %w", err)
	}
	h.Pool = pool

	pgHost, err := pgC.Host(ctx)
	if err != nil {
		h.Stop()
		return nil, fmt.Errorf("testutil: postgres host: %w", err)
	}
	pgPort, err := pgC.MappedPort(ctx, "5432/tcp")
	if err != nil {
		h.Stop()
		return nil, fmt.Errorf("testutil: postgres port: %w", err)
	}
	pgPortInt, err := strconv.Atoi(pgPort.Port())
	if err != nil {
		h.Stop()
		return nil, fmt.Errorf("testutil: parse postgres port %q: %w", pgPort.Port(), err)
	}
	h.pgCfg = config.Database{
		Host:     pgHost,
		Port:     pgPortInt,
		User:     pgUser,
		Password: pgPass,
		DBName:   pgDB,
		SSLMode:  "disable",
	}

	rdC, err := tcredis.Run(ctx, rdImage)
	if err != nil {
		h.Stop()
		return nil, fmt.Errorf("testutil: start redis: %w", err)
	}
	h.RDContainer = rdC

	rdHost, err := rdC.Host(ctx)
	if err != nil {
		h.Stop()
		return nil, fmt.Errorf("testutil: redis host: %w", err)
	}
	rdPort, err := rdC.MappedPort(ctx, "6379/tcp")
	if err != nil {
		h.Stop()
		return nil, fmt.Errorf("testutil: redis port: %w", err)
	}
	h.rdCfg = config.Redis{Host: rdHost, Port: rdPort.Port()}

	h.Redis = goredis.NewClient(&goredis.Options{
		Addr: net.JoinHostPort(rdHost, rdPort.Port()),
	})
	if err := h.Redis.Ping(ctx).Err(); err != nil {
		h.Stop()
		return nil, fmt.Errorf("testutil: ping redis: %w", err)
	}

	return h, nil
}

// Stop tears down everything Start created. Safe to call on a partially
// initialised Harness (each field is nil-checked).
func (h *Harness) Stop() {
	if h == nil {
		return
	}
	if h.Redis != nil {
		_ = h.Redis.Close()
	}
	if h.Pool != nil {
		h.Pool.Close()
	}
	if h.PGContainer != nil {
		_ = testcontainers.TerminateContainer(h.PGContainer)
	}
	if h.RDContainer != nil {
		_ = testcontainers.TerminateContainer(h.RDContainer)
	}
}

// DatabaseConfig returns a config.Database wired to the live Postgres
// container, ready for postgres.New. Returns a value; take its address at the
// call site (postgres.New takes *config.Database).
func (h *Harness) DatabaseConfig() config.Database { return h.pgCfg }

// RedisConfig returns a config.Redis wired to the live Redis container, ready
// for redis.New.
func (h *Harness) RedisConfig() config.Redis { return h.rdCfg }

// Reset gives a single test a clean slate: it deletes every user (which
// cascades through all user-owned tables via FK ON DELETE rules) and flushes
// Redis (refresh tokens, rate-limit counters).
//
// We use DELETE FROM users rather than TRUNCATE users ... CASCADE on purpose.
// CASCADE-truncating users ignores ON DELETE actions and would also truncate
// problems (created_by_user_id -> users) and cards (user_id -> users),
// destroying seed/reference data. DELETE fires ON DELETE rules instead: seed
// problems are kept (created_by_user_id SET NULL), only user-owned cards are
// dropped (CASCADE), and global cards survive (user_id NULL). The users
// IDENTITY sequence is intentionally not reset; tests must use returned IDs,
// not assume id=1.
func (h *Harness) Reset(t testing.TB) {
	t.Helper()
	ctx := context.Background()

	if _, err := h.Pool.Exec(ctx, `DELETE FROM users`); err != nil {
		t.Fatalf("testutil: reset: delete users: %v", err)
	}
	if err := h.Redis.FlushDB(ctx).Err(); err != nil {
		t.Fatalf("testutil: reset: flush redis: %v", err)
	}
}
