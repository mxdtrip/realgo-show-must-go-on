-- name: CreateUser :one
INSERT INTO users (email, password_hash)
VALUES ($1, $2)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1;

-- name: GetUserByID :one
SELECT * FROM users
WHERE id = $1;

-- name: LockUserForDeletion :one
-- Blocks new child-row FK references while account erasure removes payloads.
SELECT id FROM users
WHERE id = $1
FOR UPDATE;

-- name: DeleteUserByID :exec
DELETE FROM users WHERE users.id = $1;

-- name: DeleteExtensionEventsByUserID :exec
DELETE FROM extension_events WHERE user_id = sqlc.arg(user_id)::bigint;

-- name: DeleteAIRequestLogsByUserID :exec
DELETE FROM ai_request_logs WHERE user_id = sqlc.arg(user_id)::bigint;

-- name: UpdateUserPassword :execrows
UPDATE users
SET password_hash = $2, updated_at = NOW()
WHERE id = $1;

-- name: UpdateUserProfile :one
-- Partial update: a NULL param keeps the existing value, a non-NULL value
-- (including an empty string) overwrites it. set_onboarding_completed, when
-- true, stamps onboarding_completed_at once (idempotent first completion).
UPDATE users
SET
  timezone                = COALESCE(sqlc.narg('timezone'), timezone),
  interview_date          = COALESCE(sqlc.narg('interview_date'), interview_date),
  prep_goal               = COALESCE(sqlc.narg('prep_goal'), prep_goal),
  grade                   = COALESCE(sqlc.narg('grade'), grade),
  target_company          = COALESCE(sqlc.narg('target_company'), target_company),
  target_position         = COALESCE(sqlc.narg('target_position'), target_position),
  platform                = COALESCE(sqlc.narg('platform'), platform),
  target_topics           = COALESCE(sqlc.narg('target_topics'), target_topics),
  onboarding_completed_at = CASE
    WHEN sqlc.arg('set_onboarding_completed')::bool THEN COALESCE(onboarding_completed_at, NOW())
    ELSE onboarding_completed_at
  END,
  updated_at              = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: UpdateNotificationSettings :one
-- Partial update: a NULL param keeps the current preference.
UPDATE users
SET
  notify_review_reminder = COALESCE(sqlc.narg('review_reminder'), notify_review_reminder),
  notify_weekly_digest   = COALESCE(sqlc.narg('weekly_digest'), notify_weekly_digest),
  notify_email_enabled   = COALESCE(sqlc.narg('email_enabled'), notify_email_enabled),
  updated_at             = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;
