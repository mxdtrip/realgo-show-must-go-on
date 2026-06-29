-- name: GetTodayReviews :many
SELECT rs.id, rs.user_id, rs.problem_id, rs.pattern_id, rs.next_review_at,
       rs.interval_days, rs.stability, rs.difficulty, rs.review_count,
       rs.last_rating, rs.state, rs.lapses, rs.last_review_at, rs.remaining_steps,
       p.title AS problem_title, p.url AS problem_url,
       pt.name AS pattern_title
FROM review_schedules rs
LEFT JOIN problems p ON p.id = rs.problem_id
LEFT JOIN patterns pt ON pt.id = rs.pattern_id
WHERE rs.user_id = $1 AND rs.next_review_at <= NOW()
ORDER BY rs.next_review_at ASC
LIMIT $2;

-- name: GetReviewScheduleByID :one
SELECT id, user_id, problem_id, pattern_id, next_review_at,
       interval_days, stability, difficulty, review_count, last_rating,
       state, lapses, last_review_at, remaining_steps
FROM review_schedules
WHERE id = $1 AND user_id = $2;

-- name: UpdateReviewSchedule :one
UPDATE review_schedules
SET next_review_at = $2, interval_days = $3, stability = $4, difficulty = $5,
    review_count = $6, last_rating = $7, state = $8, lapses = $9,
    last_review_at = $10, remaining_steps = $11, updated_at = NOW()
WHERE id = $1
RETURNING id, user_id, problem_id, pattern_id, next_review_at,
          interval_days, stability, difficulty, review_count, last_rating,
          state, lapses, last_review_at, remaining_steps;

-- name: CreateReviewAttempt :one
INSERT INTO review_attempts (user_id, problem_id, pattern_id, rating, review_type, duration_sec, was_correct)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, user_id, problem_id, pattern_id, rating, review_type, duration_sec, was_correct, created_at;

-- name: GetReviewStats :one
SELECT
    COUNT(*)::integer AS total_reviews,
    COUNT(*) FILTER (WHERE state = 0)::integer AS new_cards,
    COUNT(*) FILTER (WHERE state IN (1, 3))::integer AS learning_cards,
    COUNT(*) FILTER (WHERE state = 2)::integer AS review_cards
FROM review_schedules
WHERE user_id = $1;
