-- name: ListUserCards :many
SELECT
    c.id,
    c.type,
    c.question,
    c.answer,
    c.created_at,
    CASE
        WHEN c.problem_id IS NOT NULL THEN 'problem'
        WHEN c.pattern_id IS NOT NULL THEN 'pattern'
        ELSE 'custom'
    END::text AS source_entity_type,
    COALESCE(c.problem_id, c.pattern_id) AS source_entity_id,
    COALESCE(
        NULLIF(concat_ws(' · ', NULLIF(p.title, ''), NULLIF(COALESCE(cpt.name, rpt.name), '')), ''),
        NULLIF(cpt.name, ''),
        NULLIF(c.source, ''),
        'custom card'
    )::text AS source_label,
    COALESCE(rs.id, 0)::bigint AS schedule_id,
    rs.next_review_at,
    rs.last_rating,
    COALESCE(rs.review_count, 0)::integer AS review_count,
    COALESCE(rs.state, 0)::integer AS review_state
FROM cards c
LEFT JOIN LATERAL (
    SELECT id, next_review_at, last_rating, review_count, state
    FROM review_schedules
    WHERE user_id = sqlc.arg(user_id)::bigint AND card_id = c.id
    ORDER BY next_review_at ASC, id ASC
    LIMIT 1
) rs ON true
LEFT JOIN problems p ON p.id = c.problem_id
LEFT JOIN patterns cpt ON cpt.id = c.pattern_id
LEFT JOIN roadmap_items ri ON ri.problem_id = c.problem_id AND ri.roadmap_code = 'neetcode_150'
LEFT JOIN patterns rpt ON rpt.id = ri.pattern_id
WHERE (c.user_id = sqlc.arg(user_id)::bigint OR c.user_id IS NULL OR rs.id IS NOT NULL)
  AND (sqlc.arg(card_type)::text = '' OR c.type = sqlc.arg(card_type)::text)
  AND (c.created_at, c.id) < (sqlc.arg(cursor_created_at)::timestamptz, sqlc.arg(cursor_id)::bigint)
ORDER BY c.created_at DESC, c.id DESC
LIMIT sqlc.arg(limit_rows)::integer;

-- name: ListCardSession :many
SELECT
    c.id,
    c.type,
    c.question,
    c.answer,
    c.created_at,
    CASE
        WHEN c.problem_id IS NOT NULL THEN 'problem'
        WHEN c.pattern_id IS NOT NULL THEN 'pattern'
        ELSE 'custom'
    END::text AS source_entity_type,
    COALESCE(c.problem_id, c.pattern_id) AS source_entity_id,
    COALESCE(
        NULLIF(concat_ws(' · ', NULLIF(p.title, ''), NULLIF(COALESCE(cpt.name, rpt.name), '')), ''),
        NULLIF(cpt.name, ''),
        NULLIF(c.source, ''),
        'custom card'
    )::text AS source_label,
    COALESCE(rs.id, 0)::bigint AS schedule_id,
    rs.next_review_at,
    rs.last_rating,
    COALESCE(rs.review_count, 0)::integer AS review_count,
    COALESCE(rs.state, 0)::integer AS review_state
FROM cards c
LEFT JOIN LATERAL (
    SELECT id, next_review_at, last_rating, review_count, state
    FROM review_schedules
    WHERE user_id = sqlc.arg(user_id)::bigint AND card_id = c.id
    ORDER BY next_review_at ASC, id ASC
    LIMIT 1
) rs ON true
LEFT JOIN problems p ON p.id = c.problem_id
LEFT JOIN patterns cpt ON cpt.id = c.pattern_id
LEFT JOIN roadmap_items ri ON ri.problem_id = c.problem_id AND ri.roadmap_code = 'neetcode_150'
LEFT JOIN patterns rpt ON rpt.id = ri.pattern_id
WHERE (c.user_id = sqlc.arg(user_id)::bigint OR c.user_id IS NULL OR rs.id IS NOT NULL)
  AND (
    (sqlc.arg(scope)::text = 'due' AND rs.next_review_at <= NOW())
    OR (sqlc.arg(scope)::text = 'hard_normal' AND rs.last_rating IN ('hard', 'normal'))
    OR (sqlc.arg(scope)::text = 'all')
  )
ORDER BY
    CASE
        WHEN rs.next_review_at <= NOW() THEN 0
        WHEN rs.id IS NULL THEN 1
        ELSE 2
    END,
    rs.next_review_at ASC NULLS LAST,
    c.created_at DESC,
    c.id DESC
LIMIT sqlc.arg(card_limit)::integer;

-- name: GetCardReviewSchedule :one
SELECT id
FROM review_schedules
WHERE user_id = $1 AND card_id = $2
ORDER BY id ASC
LIMIT 1;

-- name: GetAccessibleCard :one
SELECT c.id
FROM cards c
WHERE c.id = sqlc.arg(card_id)::bigint
  AND (
    c.user_id = sqlc.arg(user_id)::bigint
    OR c.user_id IS NULL
    OR EXISTS (
        SELECT 1
        FROM review_schedules rs
        WHERE rs.user_id = sqlc.arg(user_id)::bigint AND rs.card_id = c.id
    )
  );

-- name: CreateCardReviewSchedule :one
INSERT INTO review_schedules (
    user_id, card_id, next_review_at, interval_days,
    ease, stability, difficulty, review_count, algorithm
)
VALUES ($1, $2, $3, 0, 2.5, 0.1, 5.0, 0, 'fsrs')
RETURNING id;

-- name: CountCardSessionAttempts :one
SELECT COUNT(*)::integer
FROM review_attempts
WHERE user_id = $1
  AND card_id IS NOT NULL
  AND created_at >= $2;
