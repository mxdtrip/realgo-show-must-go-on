-- name: GetPlatformByCode :one
SELECT id, code, name, base_url
FROM platforms
WHERE code = $1;

-- name: UpsertExtensionProblem :one
-- Find-or-create the catalog problem keyed by (platform, external slug).
INSERT INTO problems (platform_id, external_slug, title, url, difficulty, source_type, created_by_user_id)
VALUES ($1, $2, $3, $4, $5, 'extension', $6)
ON CONFLICT (platform_id, external_slug) DO UPDATE
    SET title = EXCLUDED.title,
        url = EXCLUDED.url,
        difficulty = COALESCE(EXCLUDED.difficulty, problems.difficulty),
        updated_at = NOW()
RETURNING id;

-- name: InsertExtensionEvent :one
-- Idempotent on user_id + idempotency_key: a replayed event inserts nothing and the
-- caller detects the no-row result as a duplicate.
INSERT INTO extension_events (
    user_id, platform_id, url, external_slug, title,
    event_type, rating, extension_version, event_time, idempotency_key, raw_payload
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key <> '' DO NOTHING
RETURNING id;

-- name: UpsertSolvedProgress :exec
INSERT INTO user_problem_progress (
    user_id, problem_id, status, rating, first_seen_at, solved_at, last_reviewed_at
)
VALUES ($1, $2, 'reviewing', $3, $4, $4, $4)
ON CONFLICT (user_id, problem_id) DO UPDATE
    SET status = 'reviewing',
        rating = EXCLUDED.rating,
        solved_at = COALESCE(user_problem_progress.solved_at, EXCLUDED.solved_at),
        last_reviewed_at = EXCLUDED.last_reviewed_at;

-- name: GetProblemReviewSchedule :one
SELECT id, next_review_at, review_count
FROM review_schedules
WHERE user_id = $1 AND problem_id = $2;

-- name: CreateProblemReviewSchedule :one
INSERT INTO review_schedules (
    user_id, problem_id, next_review_at, interval_days,
    ease, stability, difficulty, review_count, last_rating, algorithm
)
VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9)
ON CONFLICT (user_id, problem_id) WHERE problem_id IS NOT NULL DO UPDATE
SET next_review_at = EXCLUDED.next_review_at,
    interval_days = EXCLUDED.interval_days,
    stability = EXCLUDED.stability,
    difficulty = EXCLUDED.difficulty,
    review_count = review_schedules.review_count + 1,
    last_rating = EXCLUDED.last_rating,
    updated_at = NOW()
RETURNING id, next_review_at;

-- name: AdvanceProblemReviewSchedule :one
UPDATE review_schedules
SET next_review_at = $2,
    interval_days = $3,
    review_count = review_count + 1,
    last_rating = $4,
    updated_at = NOW()
WHERE id = $1
RETURNING id, next_review_at;

-- name: ListExtensionPlatformStatuses :many
SELECT
    p.code AS source,
    'connected'::text AS status,
    MAX(ee.event_time)::timestamptz AS last_sync_at
FROM extension_events ee
JOIN platforms p ON p.id = ee.platform_id
WHERE ee.user_id = sqlc.arg(user_id)::bigint
GROUP BY p.code
ORDER BY last_sync_at DESC, p.code ASC;

-- name: ListExtensionRecentEvents :many
SELECT
    COALESCE(ee.idempotency_key, ee.id::text)::text AS event_id,
    p.code AS source,
    ee.event_type AS event,
    COALESCE(NULLIF(ee.title, ''), NULLIF(ee.external_slug, ''), ee.url) AS title,
    ee.event_time AS occurred_at
FROM extension_events ee
JOIN platforms p ON p.id = ee.platform_id
WHERE ee.user_id = sqlc.arg(user_id)::bigint
ORDER BY ee.event_time DESC, ee.id DESC
LIMIT sqlc.arg(event_limit)::int;
