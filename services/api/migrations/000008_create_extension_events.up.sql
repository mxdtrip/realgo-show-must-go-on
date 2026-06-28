CREATE TABLE IF NOT EXISTS extension_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    platform_id BIGINT NOT NULL REFERENCES platforms(id),
    url TEXT NOT NULL,
    external_slug TEXT,
    title TEXT,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('problem_viewed', 'problem_started', 'problem_submitted', 'problem_solved', 'rating_changed')),
    rating INTEGER,
    extension_version VARCHAR(50),
    event_time TIMESTAMP WITH TIME ZONE NOT NULL,
    idempotency_key TEXT UNIQUE,
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
