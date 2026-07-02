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

// Harness поднимает одноразовую пару Postgres + Redis (testcontainers),
// применяет настоящие миграции проекта и используется в acceptance- и
// integration-тестах.
//
// Жизненный цикл: один раз вызвать Start в TestMain, переиспользовать Harness
// во всех тестах пакета, затем один раз вызвать Stop после m.Run().
// Для изоляции тестов вызывайте Reset в начале каждого теста.
// Здесь нет заглушек — все зависимости представлены реальными контейнерами.
type Harness struct {
	PGContainer testcontainers.Container
	RDContainer *tcredis.RedisContainer

	Pool  *pgxpool.Pool   // pgx pool over the migrated Postgres
	Redis *goredis.Client // live Redis client

	pgCfg config.Database // cached for DatabaseConfig()
	rdCfg config.Redis    // cached for RedisConfig()
}

const (
	pgImage = "postgres:16-alpine"
	pgUser  = "test"
	pgPass  = "test"
	pgDB    = "testdb"
	rdImage = "redis:7-alpine"
)

// Start запускает оба контейнера, применяет все встроенные миграции,
// создаёт pgx-пул и проверяет доступность всех зависимостей через ping.
// После завершения работы вызывающая сторона ОБЯЗАНА вызвать Stop
// (обычно один раз после m.Run()).
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
	// Повторяем значения по умолчанию из production-конфигурации
	// (env-defaults в config.go). Все эти поля postgres.New напрямую
	// копирует в конфигурацию pgxpool, поэтому если оставить какое-либо
	// из них равным нулевому значению Go, в тестах воспроизведётся
	// поведение production-приложения с некорректной конфигурацией:
	//
	//   - MaxConns == 0 → pgxpool отклонит конфигурацию
	//     ("MaxSize must be >= 1").
	//
	//   - MaxConnLifetime == 0 → в pgxpool v5.10.0 каждое соединение
	//     получает maxAgeTime = now, поэтому проверка isExpired в
	//     Pool.Acquire уничтожает соединение сразу при получении, после
	//     чего пул завершает попытки с вводящей в заблуждение ошибкой
	//     "too many failed attempts acquiring connection".
	//     Значение должно быть больше нуля.
	//
	//   - MaxConnIdleTime == 0 → фоновая проверка состояния пула постоянно
	//     пересоздаёт простаивающие соединения.
	h.pgCfg = config.Database{
		Host:            pgHost,
		Port:            pgPortInt,
		User:            pgUser,
		Password:        pgPass,
		DBName:          pgDB,
		SSLMode:         "disable",
		MaxConns:        10,
		MinConns:        2,
		MaxConnLifetime: time.Hour,
		MaxConnIdleTime: 30 * time.Minute,
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

// Stop освобождает все ресурсы, созданные Start.
// Безопасно вызывать даже для частично инициализированного Harness:
// каждое поле предварительно проверяется на nil.
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

// DatabaseConfig возвращает config.Database, настроенный для подключения
// к работающему контейнеру Postgres и готовый для передачи в postgres.New.
// Возвращается значение; при вызове нужно взять его адрес,
// поскольку postgres.New принимает *config.Database.
func (h *Harness) DatabaseConfig() config.Database { return h.pgCfg }

// RedisConfig возвращает config.Redis, настроенный для подключения
// к работающему контейнеру Redis и готовый для передачи в redis.New.
func (h *Harness) RedisConfig() config.Redis { return h.rdCfg }

// Reset подготавливает чистое состояние для одного теста:
// удаляет всех пользователей (что благодаря правилам FK ON DELETE
// автоматически очищает все принадлежащие им данные)
// и полностью очищает Redis (refresh-токены, счётчики rate limiting и т.п.).
//
// Мы намеренно используем DELETE FROM users, а не
// TRUNCATE users ... CASCADE.
//
// TRUNCATE ... CASCADE игнорирует правила ON DELETE и также очистит
// таблицы problems (created_by_user_id → users) и
// cards (user_id → users), уничтожив сидовые и справочные данные.
//
// DELETE, напротив, запускает обработку правил ON DELETE:
//   - сидовые задачи сохраняются благодаря SET NULL для
//     created_by_user_id;
//   - удаляются только карточки, принадлежащие пользователям (CASCADE);
//   - глобальные карточки (user_id IS NULL) остаются.
//
// Последовательность IDENTITY для users намеренно не сбрасывается.
// Тесты должны использовать идентификаторы, возвращённые системой,
// а не предполагать, что первый пользователь всегда имеет id = 1.
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
