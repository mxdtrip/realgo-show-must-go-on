-- name: GetDashboardMetrics :one
WITH settings AS (
    SELECT COALESCE(NULLIF(u.timezone, ''), 'UTC')::text AS tz
    FROM users u
    WHERE u.id = $1
),
today AS (
    SELECT (NOW() AT TIME ZONE COALESCE((SELECT tz FROM settings), 'UTC'))::date AS day
),
due AS (
    SELECT
        COUNT(*) FILTER (WHERE next_review_at <= NOW())::integer AS due_count,
        COUNT(*) FILTER (WHERE next_review_at <= NOW() AND problem_id IS NOT NULL)::integer AS due_problem_count,
        COUNT(*) FILTER (WHERE next_review_at <= NOW() AND card_id IS NOT NULL)::integer AS due_card_count,
        COUNT(*) FILTER (WHERE next_review_at <= NOW() AND pattern_id IS NOT NULL)::integer AS due_pattern_count
    FROM review_schedules
    WHERE user_id = $1
),
progress AS (
    SELECT
        COUNT(*) FILTER (
            WHERE solved_at IS NOT NULL
               OR status IN ('solved', 'reviewing')
        )::integer AS solved_count,
        COUNT(*) FILTER (
            WHERE confidence IS NOT NULL
               OR rating IS NOT NULL
               OR status IN ('in_progress', 'solved', 'reviewing')
        )::integer AS progress_count,
        ROUND(COALESCE(AVG(
            CASE
                WHEN confidence IS NOT NULL THEN LEAST(100, GREATEST(0, confidence))
                WHEN rating = 'easy' THEN 85
                WHEN rating = 'normal' THEN 65
                WHEN rating = 'hard' THEN 35
                WHEN status IN ('solved', 'reviewing') THEN 60
                WHEN status = 'in_progress' THEN 30
                ELSE 0
            END
        ) FILTER (
            WHERE confidence IS NOT NULL
               OR rating IS NOT NULL
               OR status IN ('in_progress', 'solved', 'reviewing')
        ), 0))::integer AS readiness
    FROM user_problem_progress
    WHERE user_id = $1
),
activity_days AS (
    SELECT DISTINCT activity_day
    FROM (
        SELECT (ra.created_at AT TIME ZONE COALESCE((SELECT tz FROM settings), 'UTC'))::date AS activity_day
        FROM review_attempts ra
        WHERE ra.user_id = $1
        UNION ALL
        SELECT (upp.solved_at AT TIME ZONE COALESCE((SELECT tz FROM settings), 'UTC'))::date AS activity_day
        FROM user_problem_progress upp
        WHERE upp.user_id = $1 AND upp.solved_at IS NOT NULL
    ) days
    WHERE activity_day IS NOT NULL
      AND activity_day <= (SELECT day FROM today)
),
ranked_days AS (
    SELECT
        activity_day,
        ROW_NUMBER() OVER (ORDER BY activity_day DESC)::integer AS rn
    FROM activity_days
),
streak AS (
    SELECT COUNT(*)::integer AS current_streak
    FROM ranked_days, today
    WHERE activity_day = today.day - (rn - 1)
)
SELECT
    COALESCE((SELECT due_count FROM due), 0)::integer AS due_count,
    COALESCE((SELECT due_problem_count FROM due), 0)::integer AS due_problem_count,
    COALESCE((SELECT due_card_count FROM due), 0)::integer AS due_card_count,
    COALESCE((SELECT due_pattern_count FROM due), 0)::integer AS due_pattern_count,
    COALESCE((SELECT solved_count FROM progress), 0)::integer AS solved_count,
    COALESCE((SELECT progress_count FROM progress), 0)::integer AS progress_count,
    COALESCE((SELECT readiness FROM progress), 0)::integer AS readiness,
    COALESCE((SELECT current_streak FROM streak), 0)::integer AS current_streak;

-- name: ListDashboardActivity :many
-- Per-day activity counts for the heatmap: review attempts + problem solves,
-- bucketed by the user's timezone, newest window of sqlc.arg(days) days.
WITH settings AS (
    SELECT COALESCE(NULLIF(u.timezone, ''), 'UTC')::text AS tz
    FROM users u
    WHERE u.id = sqlc.arg(user_id)::bigint
),
today AS (
    SELECT (NOW() AT TIME ZONE COALESCE((SELECT tz FROM settings), 'UTC'))::date AS day
),
events AS (
    SELECT (ra.created_at AT TIME ZONE COALESCE((SELECT tz FROM settings), 'UTC'))::date AS activity_day
    FROM review_attempts ra
    WHERE ra.user_id = sqlc.arg(user_id)::bigint
    UNION ALL
    SELECT (upp.solved_at AT TIME ZONE COALESCE((SELECT tz FROM settings), 'UTC'))::date AS activity_day
    FROM user_problem_progress upp
    WHERE upp.user_id = sqlc.arg(user_id)::bigint AND upp.solved_at IS NOT NULL
)
SELECT events.activity_day::date AS day, COUNT(*)::integer AS count
FROM events, today
WHERE events.activity_day IS NOT NULL
  AND events.activity_day <= today.day
  AND events.activity_day > today.day - sqlc.arg(days)::integer
GROUP BY events.activity_day
ORDER BY events.activity_day ASC;

-- name: ListDashboardReviewPreview :many
SELECT
    rs.id,
    CASE
        WHEN rs.problem_id IS NOT NULL THEN 'problem'
        WHEN rs.card_id IS NOT NULL THEN 'card'
        WHEN rs.pattern_id IS NOT NULL THEN 'pattern'
        ELSE 'unknown'
    END::text AS entity_type,
    COALESCE(p.title, cp.title, c.question, sp.name, 'Review')::text AS title,
    COALESCE(rp.name, sp.name, csp.name, crp.name, '')::text AS pattern_name,
    COALESCE(p.difficulty, cp.difficulty, '')::text AS difficulty,
    rs.next_review_at,
    rs.last_rating,
    COALESCE(rs.review_count, 0)::integer AS review_count
FROM review_schedules rs
LEFT JOIN problems p ON p.id = rs.problem_id
LEFT JOIN roadmap_items ri
    ON ri.problem_id = rs.problem_id AND ri.roadmap_code = 'neetcode_150'
LEFT JOIN patterns rp ON rp.id = ri.pattern_id
LEFT JOIN patterns sp ON sp.id = rs.pattern_id
LEFT JOIN cards c ON c.id = rs.card_id
LEFT JOIN patterns csp ON csp.id = c.pattern_id
LEFT JOIN problems cp ON cp.id = c.problem_id
LEFT JOIN roadmap_items cri
    ON cri.problem_id = c.problem_id AND cri.roadmap_code = 'neetcode_150'
LEFT JOIN patterns crp ON crp.id = cri.pattern_id
WHERE rs.user_id = $1
  AND rs.next_review_at <= NOW()
ORDER BY rs.next_review_at ASC, rs.id ASC
LIMIT $2;

-- name: GetDashboardNextReview :one
SELECT
    rs.id,
    CASE
        WHEN rs.problem_id IS NOT NULL THEN 'problem'
        WHEN rs.card_id IS NOT NULL THEN 'card'
        WHEN rs.pattern_id IS NOT NULL THEN 'pattern'
        ELSE 'unknown'
    END::text AS entity_type,
    COALESCE(p.title, cp.title, c.question, sp.name, 'Review')::text AS title,
    COALESCE(rp.name, sp.name, csp.name, crp.name, '')::text AS pattern_name,
    COALESCE(p.difficulty, cp.difficulty, '')::text AS difficulty,
    rs.next_review_at,
    rs.last_rating,
    COALESCE(rs.review_count, 0)::integer AS review_count
FROM review_schedules rs
LEFT JOIN problems p ON p.id = rs.problem_id
LEFT JOIN roadmap_items ri
    ON ri.problem_id = rs.problem_id AND ri.roadmap_code = 'neetcode_150'
LEFT JOIN patterns rp ON rp.id = ri.pattern_id
LEFT JOIN patterns sp ON sp.id = rs.pattern_id
LEFT JOIN cards c ON c.id = rs.card_id
LEFT JOIN patterns csp ON csp.id = c.pattern_id
LEFT JOIN problems cp ON cp.id = c.problem_id
LEFT JOIN roadmap_items cri
    ON cri.problem_id = c.problem_id AND cri.roadmap_code = 'neetcode_150'
LEFT JOIN patterns crp ON crp.id = cri.pattern_id
WHERE rs.user_id = $1
ORDER BY rs.next_review_at ASC, rs.id ASC
LIMIT 1;
