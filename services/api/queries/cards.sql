-- name: ListUserCards :many
-- All cards owned by the user, newest first, with schedule status.
SELECT
    c.id,
    c.type,
    c.question,
    c.answer,
    c.explanation,
    c.source,
    c.created_by_ai,
    c.created_at,
    p.title          AS problem_title,
    p.url            AS problem_url,
    pat.name         AS pattern_name,
    rs.id            AS schedule_id,
    rs.next_review_at,
    rs.last_rating,
    COALESCE(rs.review_count, 0)::int AS review_count,
    rs.state
FROM cards c
LEFT JOIN problems p   ON p.id   = c.problem_id
LEFT JOIN patterns pat ON pat.id = c.pattern_id
LEFT JOIN review_schedules rs ON rs.card_id = c.id AND rs.user_id = c.user_id
WHERE c.user_id = $1::bigint
ORDER BY c.created_at DESC
LIMIT $2::int;

-- name: ListDueCardSessions :many
-- Cards due for review (next_review_at <= NOW()), with full card content.
SELECT
    rs.id            AS schedule_id,
    c.id             AS card_id,
    c.type,
    c.question,
    c.answer,
    c.explanation,
    p.title          AS problem_title,
    p.url            AS problem_url,
    pat.name         AS pattern_name,
    rs.next_review_at,
    rs.last_rating,
    COALESCE(rs.review_count, 0)::int AS review_count,
    rs.state
FROM review_schedules rs
JOIN cards c           ON c.id   = rs.card_id
LEFT JOIN problems p   ON p.id   = c.problem_id
LEFT JOIN patterns pat ON pat.id = c.pattern_id
WHERE rs.user_id     = $1::bigint
  AND rs.card_id     IS NOT NULL
  AND rs.next_review_at <= NOW()
ORDER BY rs.next_review_at ASC
LIMIT $2::int;

-- name: GetCardScheduleForUser :one
-- Resolve review_schedule.id for a (card_id, user_id) pair.
SELECT rs.id
FROM review_schedules rs
WHERE rs.card_id  = $1::bigint
  AND rs.user_id  = $2::bigint;
