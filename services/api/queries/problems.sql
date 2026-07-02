-- name: GetUserProblem :one
-- Single problem with user progress and review schedule.
SELECT
    p.id,
    COALESCE(p.external_id, p.external_slug)::text AS external_id,
    p.title,
    p.url,
    CASE WHEN pl.code IN ('leetcode','neetcode','codeforces') THEN pl.code ELSE 'custom' END AS platform,
    COALESCE(p.difficulty, 'unknown')::text AS difficulty,
    pt.code                                AS pattern_id,
    pt.name                                AS pattern_name,
    CASE
        WHEN upp.status = 'reviewing'   THEN 'reviewing'
        WHEN upp.status = 'solved'      THEN 'solved'
        WHEN upp.status = 'in_progress' THEN 'in_progress'
        WHEN upp.status = 'skipped'     THEN 'skipped'
        WHEN upp.status = 'not_started' THEN 'not_started'
        ELSE 'unsaved'
    END::text                              AS status,
    rs.next_review_at,
    COALESCE(rs.last_rating, upp.rating)   AS last_rating,
    upp.solved_at,
    upp.note,
    COALESCE(p.created_at,'1970-01-01 00:00:00+00'::timestamptz) AS created_at
FROM problems p
JOIN platforms pl ON pl.id = p.platform_id
LEFT JOIN user_problem_progress upp ON upp.user_id = sqlc.arg(user_id)::bigint AND upp.problem_id = p.id
LEFT JOIN LATERAL (
    SELECT next_review_at, last_rating
    FROM review_schedules
    WHERE user_id = sqlc.arg(user_id)::bigint AND problem_id = p.id
    ORDER BY next_review_at ASC LIMIT 1
) rs ON TRUE
LEFT JOIN roadmap_items ri ON ri.problem_id = p.id AND ri.roadmap_code = 'neetcode_150'
LEFT JOIN patterns pt ON pt.id = ri.pattern_id
WHERE p.id = sqlc.arg(problem_id)::bigint;

-- name: UpsertProblemProgress :one
-- Save a problem to the user's list (idempotent; won't downgrade reviewing/solved status).
INSERT INTO user_problem_progress (user_id, problem_id, status, first_seen_at)
VALUES (sqlc.arg(user_id)::bigint, sqlc.arg(problem_id)::bigint, 'not_started', NOW())
ON CONFLICT (user_id, problem_id) DO UPDATE
    SET status = CASE
        WHEN user_problem_progress.status IN ('reviewing','solved','in_progress') THEN user_problem_progress.status
        ELSE 'not_started'
    END,
    first_seen_at = COALESCE(user_problem_progress.first_seen_at, EXCLUDED.first_seen_at)
RETURNING user_id, problem_id, status;

-- name: CreateProblemScheduleIfAbsent :one
-- Create review schedule only when none exists yet.
INSERT INTO review_schedules (user_id, problem_id, next_review_at, interval_days, ease, stability, difficulty, review_count, algorithm, state)
SELECT sqlc.arg(user_id)::bigint, sqlc.arg(problem_id)::bigint, NOW(), 1, 2.5, 1.0, 5.0, 0, 'fsrs', 0
WHERE NOT EXISTS (
    SELECT 1 FROM review_schedules
    WHERE user_id = sqlc.arg(user_id)::bigint AND problem_id = sqlc.arg(problem_id)::bigint
)
RETURNING id;

-- name: ListUserProblems :many
WITH scoped_problems AS (
    SELECT
        p.id,
        COALESCE(p.external_id, p.external_slug) AS external_id,
        p.title,
        p.url,
        CASE
            WHEN pl.code IN ('leetcode', 'neetcode', 'codeforces') THEN pl.code
            ELSE 'custom'
        END AS platform,
        CASE
            WHEN p.difficulty IS NULL THEN 'unknown'
            ELSE p.difficulty::text
        END AS difficulty,
        CASE
            WHEN upp.status = 'reviewing' THEN 'reviewing'
            WHEN upp.status = 'solved' THEN 'mastered'
            WHEN upp.status = 'mastered' THEN 'mastered'
            WHEN upp.status = 'skipped' THEN 'archived'
            WHEN upp.status = 'archived' THEN 'archived'
            ELSE 'saved'
        END AS status,
        pt.code AS pattern_id,
        pt.name AS pattern_name,
        rs.next_review_at,
        COALESCE(rs.last_rating, upp.rating) AS last_rating,
        upp.solved_at,
        COALESCE(p.created_at, '1970-01-01 00:00:00+00'::timestamptz) AS created_at,
        COALESCE(p.updated_at, p.created_at, '1970-01-01 00:00:00+00'::timestamptz) AS updated_at
    FROM problems p
    JOIN platforms pl ON pl.id = p.platform_id
    LEFT JOIN user_problem_progress upp
        ON upp.user_id = sqlc.arg(user_id) AND upp.problem_id = p.id
    LEFT JOIN LATERAL (
        SELECT next_review_at, last_rating
        FROM review_schedules
        WHERE user_id = sqlc.arg(user_id)
          AND problem_id = p.id
        ORDER BY next_review_at ASC, id ASC
        LIMIT 1
    ) rs ON TRUE
    LEFT JOIN roadmap_items ri
        ON ri.problem_id = p.id AND ri.roadmap_code = 'neetcode_150'
    LEFT JOIN patterns pt ON pt.id = ri.pattern_id
    WHERE upp.user_id IS NOT NULL
       OR p.created_by_user_id = sqlc.arg(user_id)
       OR rs.next_review_at IS NOT NULL
)
SELECT
    id,
    external_id,
    title,
    url,
    platform,
    difficulty,
    pattern_id,
    pattern_name,
    status,
    next_review_at,
    last_rating,
    solved_at,
    created_at,
    updated_at
FROM scoped_problems
WHERE (sqlc.arg(status)::text = '' OR status = sqlc.arg(status)::text)
  AND (sqlc.arg(platform)::text = '' OR platform = sqlc.arg(platform)::text)
  AND (created_at, id) < (sqlc.arg(cursor_created_at)::timestamptz, sqlc.arg(cursor_id)::bigint)
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(limit_rows)::int;
