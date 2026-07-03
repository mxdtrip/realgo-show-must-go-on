BEGIN;

CREATE TABLE extension_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    platform_id BIGINT NOT NULL REFERENCES platforms(id),
    url TEXT NOT NULL,
    external_slug TEXT,
    title TEXT,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('problem_viewed', 'problem_submitted', 'problem_solved', 'rating_changed', 'sync_disabled')),
    rating TEXT CHECK (rating IS NULL OR rating IN ('hard', 'normal', 'easy')),
    extension_version VARCHAR(50),
    event_time TIMESTAMPTZ NOT NULL,
    idempotency_key TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX extension_events_user_idempotency_key_unique
    ON extension_events (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

COMMIT;
