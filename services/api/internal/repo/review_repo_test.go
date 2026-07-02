package repo_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/mxdtrip/freeburger/services/api/internal/entity"
	"github.com/mxdtrip/freeburger/services/api/internal/repo"
)

func TestReviewRepository_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()

	// Запускаем PostgreSQL контейнер
	pgContainer, err := postgres.Run(ctx,
		"postgres:17-alpine",
		postgres.WithDatabase("testdb"),
		postgres.WithUsername("test"),
		postgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").WithOccurrence(2).WithStartupTimeout(time.Minute),
		),
	)
	if err != nil {
		t.Fatalf("failed to start container: %v", err)
	}
	defer func() {
		if err := testcontainers.TerminateContainer(pgContainer); err != nil {
			t.Logf("failed to terminate container: %v", err)
		}
	}()

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("failed to get connection string: %v", err)
	}

	// Создаём схему БД
	pool, cleanup := setupTestDB(t, ctx, connStr)
	defer cleanup()

	// Создаём репозиторий
	reviewRepo := repo.NewReviewRepository(pool)

	t.Run("GetScheduleByID_NotFound", func(t *testing.T) {
		_, err := reviewRepo.ScheduleByID(ctx, 999, 1)
		if err != repo.ErrReviewNotFound {
			t.Errorf("expected ErrReviewNotFound, got %v", err)
		}
	})

	t.Run("QueueReviews_Empty", func(t *testing.T) {
		items, err := reviewRepo.QueueReviews(ctx, 1, "due", 10)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(items) != 0 {
			t.Errorf("expected empty result, got %d items", len(items))
		}
	})

	t.Run("SaveReview_Success", func(t *testing.T) {
		// Создаём тестовые данные
		userID := insertTestUser(t, ctx, pool)
		problemID := insertTestProblem(t, ctx, pool, userID)

		// Создаём расписание напрямую в БД
		scheduleID := insertTestSchedule(t, ctx, pool, userID, problemID, nil)

		// Получаем расписание
		schedule, err := reviewRepo.ScheduleByID(ctx, scheduleID, userID)
		if err != nil {
			t.Fatalf("failed to get schedule: %v", err)
		}

		// Обновляем через SaveReview
		now := time.Now().UTC().Truncate(time.Microsecond)
		schedule.NextReviewAt = now.Add(24 * time.Hour)
		schedule.IntervalDays = 1.0
		schedule.Stability = 2.5
		schedule.Difficulty = 0.5
		schedule.ReviewCount = 1
		rating := "normal"
		schedule.LastRating = &rating
		schedule.State = 1
		schedule.Lapses = 0
		schedule.LastReviewAt = &now
		schedule.RemainingSteps = 0

		attempt := entity.ReviewAttempt{
			UserID:      userID,
			ProblemID:   &problemID,
			Rating:      "normal",
			DurationSec: 30,
		}

		updated, err := reviewRepo.SaveReview(ctx, schedule, attempt)
		if err != nil {
			t.Fatalf("SaveReview failed: %v", err)
		}

		if updated.ID != scheduleID {
			t.Errorf("expected scheduleID %d, got %d", scheduleID, updated.ID)
		}
		if updated.ReviewCount != 1 {
			t.Errorf("expected ReviewCount 1, got %d", updated.ReviewCount)
		}
	})

	t.Run("Stats_Success", func(t *testing.T) {
		stats, err := reviewRepo.Stats(ctx, 1)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// Проверяем что запрос выполняется без ошибок
		_ = stats
	})
}

// setupTestDB создаёт схему БД для тестов
func setupTestDB(t *testing.T, ctx context.Context, connStr string) (pool *pgxpool.Pool, cleanup func()) {
	t.Helper()

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		t.Fatalf("failed to create pool: %v", err)
	}

	// Создаём минимальную схему для тестов
	schema := `
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    plan VARCHAR(50) DEFAULT 'free',
    interview_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platforms (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    base_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patterns (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id BIGINT REFERENCES patterns(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cards (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL CHECK (type IN ('pattern_recognition', 'algorithm_mechanics', 'edge_case')),
    content TEXT NOT NULL,
    answer TEXT,
    pattern_id BIGINT REFERENCES patterns(id) ON DELETE CASCADE,
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS problems (
    id BIGSERIAL PRIMARY KEY,
    platform_id BIGINT REFERENCES platforms(id) ON DELETE CASCADE,
    external_slug TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),
    source_type VARCHAR(50) CHECK (source_type IN ('roadmap', 'manual', 'extension', 'ai')),
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    external_id TEXT,
    UNIQUE(platform_id, external_slug)
);

CREATE TABLE IF NOT EXISTS review_schedules (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id BIGINT REFERENCES problems(id) ON DELETE CASCADE,
    pattern_id BIGINT REFERENCES patterns(id) ON DELETE CASCADE,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    next_review_at TIMESTAMP WITH TIME ZONE NOT NULL,
    interval_days DOUBLE PRECISION NOT NULL,
    ease DOUBLE PRECISION NOT NULL,
    stability DOUBLE PRECISION NOT NULL,
    difficulty DOUBLE PRECISION NOT NULL,
    review_count INTEGER DEFAULT 0,
    last_rating TEXT,
    algorithm TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    state SMALLINT NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    last_review_at TIMESTAMP WITH TIME ZONE,
    remaining_steps INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT problem_or_pattern_or_card_check CHECK (
        (problem_id IS NOT NULL)::int + (pattern_id IS NOT NULL)::int + (card_id IS NOT NULL)::int = 1
    ),
    CONSTRAINT review_schedule_last_rating_check CHECK (last_rating IS NULL OR last_rating IN ('hard', 'normal', 'easy'))
);

CREATE TABLE IF NOT EXISTS review_attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id BIGINT REFERENCES problems(id) ON DELETE CASCADE,
    pattern_id BIGINT REFERENCES patterns(id) ON DELETE CASCADE,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    rating TEXT NOT NULL,
    review_type VARCHAR(50) CHECK (review_type IN ('problem', 'pattern', 'card')),
    duration_sec INTEGER,
    was_correct BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT review_attempt_rating_check CHECK (rating IN ('hard', 'normal', 'easy'))
);
`

	_, err = pool.Exec(ctx, schema)
	if err != nil {
		pool.Close()
		t.Fatalf("failed to create schema: %v", err)
	}

	return pool, func() { pool.Close() }
}

func insertTestUser(t *testing.T, ctx context.Context, pool *pgxpool.Pool) int64 {
	t.Helper()

	var userID int64
	err := pool.QueryRow(ctx,
		"INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
		"test@example.com", "hash",
	).Scan(&userID)
	if err != nil {
		t.Fatalf("failed to insert user: %v", err)
	}
	return userID
}

func insertTestProblem(t *testing.T, ctx context.Context, pool *pgxpool.Pool, userID int64) int64 {
	t.Helper()

	// Сначала вставляем платформу
	var platformID int64
	err := pool.QueryRow(ctx,
		"INSERT INTO platforms (code, name, base_url) VALUES ($1, $2, $3) RETURNING id",
		"leetcode", "LeetCode", "https://leetcode.com",
	).Scan(&platformID)
	if err != nil {
		t.Fatalf("failed to insert platform: %v", err)
	}

	var problemID int64
	err = pool.QueryRow(ctx,
		`INSERT INTO problems (platform_id, external_slug, title, url, difficulty, source_type, created_by_user_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		platformID, "two-sum", "Two Sum", "https://leetcode.com/problems/two-sum", "easy", "manual", userID,
	).Scan(&problemID)
	if err != nil {
		t.Fatalf("failed to insert problem: %v", err)
	}
	return problemID
}

func insertTestSchedule(t *testing.T, ctx context.Context, pool *pgxpool.Pool, userID, problemID int64, patternID *int64) int64 {
	t.Helper()

	var scheduleID int64
	err := pool.QueryRow(ctx,
		`INSERT INTO review_schedules (user_id, problem_id, pattern_id, next_review_at, interval_days, ease, stability, difficulty, review_count, state, lapses, remaining_steps)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
		userID, problemID, patternID, time.Now(), 0.0, 2.5, 0.0, 0.0, 0, 0, 0, 0,
	).Scan(&scheduleID)
	if err != nil {
		t.Fatalf("failed to insert schedule: %v", err)
	}
	return scheduleID
}
