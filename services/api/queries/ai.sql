-- name: CreateAIRequestLog :one
INSERT INTO ai_request_logs (user_id, feature, provider, model, status)
VALUES (
    sqlc.arg(user_id)::bigint,
    sqlc.arg(feature),
    'stub',
    NULL,
    'queued'
)
RETURNING id, created_at;

-- name: LogCardGenerationRequest :exec
-- Records the outcome of one CardProvisioner generation attempt (success,
-- failed, or the model's own unknown_problem/quota refusal). user_id is NULL:
-- the resulting cards are global, not tied to whichever user's solve event
-- happened to trigger generation.
INSERT INTO ai_request_logs (user_id, feature, provider, model, prompt_version, status)
VALUES (
    NULL,
    'card_generation',
    sqlc.arg(provider),
    sqlc.arg(model),
    sqlc.arg(prompt_version),
    sqlc.arg(status)
);
