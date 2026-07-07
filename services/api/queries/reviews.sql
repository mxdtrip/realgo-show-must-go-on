-- name: GetTodayReviews :many
SELECT rs.id, rs.user_id, rs.problem_id, rs.pattern_id, rs.card_id, rs.next_review_at,
       rs.interval_days, rs.stability, rs.difficulty, rs.review_count,
       rs.last_rating, rs.state, rs.lapses, rs.last_review_at, rs.remaining_steps,
       p.title AS problem_title, p.url AS problem_url,
       COALESCE(pt.name, cpt.name, rpt.name, '') AS pattern_title,
       p.difficulty AS problem_difficulty,
       c.question AS card_question,
       COALESCE(c.type, '') AS card_type
FROM review_schedules rs
LEFT JOIN cards c ON c.id = rs.card_id
LEFT JOIN problems p ON p.id = COALESCE(rs.problem_id, c.problem_id)
LEFT JOIN patterns pt ON pt.id = rs.pattern_id
LEFT JOIN patterns cpt ON cpt.id = c.pattern_id
LEFT JOIN roadmap_items ri ON ri.problem_id = p.id AND ri.roadmap_code = 'neetcode_150'
LEFT JOIN patterns rpt ON rpt.id = ri.pattern_id
WHERE rs.user_id = $1 AND rs.next_review_at <= NOW()
ORDER BY rs.next_review_at ASC
LIMIT $2;

-- name: ListReviewQueue :many
SELECT rs.id, rs.user_id, rs.problem_id, rs.pattern_id, rs.card_id, rs.next_review_at,
       rs.interval_days, rs.stability, rs.difficulty, rs.review_count,
       rs.last_rating, rs.state, rs.lapses, rs.last_review_at, rs.remaining_steps,
       p.title AS problem_title, p.url AS problem_url,
       COALESCE(pt.name, cpt.name, rpt.name, '') AS pattern_title,
       p.difficulty AS problem_difficulty,
       c.question AS card_question,
       COALESCE(c.type, '') AS card_type
FROM review_schedules rs
LEFT JOIN cards c ON c.id = rs.card_id
LEFT JOIN problems p ON p.id = COALESCE(rs.problem_id, c.problem_id)
LEFT JOIN patterns pt ON pt.id = rs.pattern_id
LEFT JOIN patterns cpt ON cpt.id = c.pattern_id
LEFT JOIN roadmap_items ri ON ri.problem_id = p.id AND ri.roadmap_code = 'neetcode_150'
LEFT JOIN patterns rpt ON rpt.id = ri.pattern_id
WHERE rs.user_id = sqlc.arg(user_id)
  AND (
    (sqlc.arg(status)::text = 'due' AND rs.next_review_at <= NOW())
    OR (sqlc.arg(status)::text = 'upcoming' AND rs.next_review_at > NOW())
  )
  -- Keyset pagination: row-wise comparison seeks strictly past the last item
  -- of the previous page on the (next_review_at, id) tiebreak.
  AND (rs.next_review_at, rs.id) > (sqlc.arg(cursor_next_review_at)::timestamptz, sqlc.arg(cursor_id)::bigint)
ORDER BY rs.next_review_at ASC, rs.id ASC
LIMIT sqlc.arg(queue_limit);

-- name: GetReviewScheduleByID :one
SELECT id, user_id, problem_id, pattern_id, card_id, next_review_at,
       interval_days, stability, difficulty, review_count, last_rating,
       state, lapses, last_review_at, remaining_steps
FROM review_schedules
WHERE id = $1 AND user_id = $2;

-- name: GetReviewScheduleIDByProblem :one
-- Возвращает id расписания задачи для пользователя. Вызывается после
-- CreateProblemScheduleIfAbsent, поэтому строка гарантированно существует.
SELECT id FROM review_schedules
WHERE user_id = $1 AND problem_id = $2;

-- name: UpdateReviewSchedule :one
UPDATE review_schedules
SET next_review_at = $2, interval_days = $3, stability = $4, difficulty = $5,
    review_count = $6, last_rating = $7, state = $8, lapses = $9,
    last_review_at = $10, remaining_steps = $11, updated_at = NOW()
WHERE id = $1 AND user_id = sqlc.arg(user_id)
RETURNING id, user_id, problem_id, pattern_id, card_id, next_review_at,
          interval_days, stability, difficulty, review_count, last_rating,
          state, lapses, last_review_at, remaining_steps;

-- name: CreateReviewAttempt :one
INSERT INTO review_attempts (user_id, problem_id, pattern_id, card_id, rating, review_type, duration_sec, was_correct)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, user_id, problem_id, pattern_id, card_id, rating, review_type, duration_sec, was_correct, created_at;

-- name: GetReviewStats :one
SELECT
    COUNT(*)::integer AS total_reviews,
    COUNT(*) FILTER (WHERE state = 0)::integer AS new_cards,
    COUNT(*) FILTER (WHERE state IN (1, 3))::integer AS learning_cards,
    COUNT(*) FILTER (WHERE state = 2)::integer AS review_cards
FROM review_schedules
WHERE user_id = $1;

-- name: UpdateProgressConfidence :exec
-- Rows created by the extension ingest have confidence = NULL, and NULL + delta
-- stays NULL, which silently disabled confidence tracking for real users. Start
-- such rows from the neutral 50 (matching the dashboard's readiness midpoint)
-- before applying the delta, clamped to [0, 100].
UPDATE user_problem_progress
SET confidence = LEAST(100, GREATEST(0, COALESCE(confidence, 50) + $3::int))
WHERE user_id = $1 AND problem_id = $2;
