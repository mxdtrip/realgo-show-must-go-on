-- name: CreateAIRequestLog :one
INSERT INTO ai_request_logs (user_id, feature, provider, model, status)
VALUES (
    sqlc.arg(user_id)::bigint,
    sqlc.arg(feature),
    'openai',
    'gpt-4o-mini',
    'queued'
)
RETURNING id, created_at;
