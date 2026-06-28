CREATE TABLE IF NOT EXISTS extension_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    platform TEXT NOT NULL,
    url TEXT NOT NULL,
    external_slug TEXT,
    title TEXT,
    event_type TEXT NOT NULL,
    rating INTEGER,
    extension_version TEXT,
    event_time TIMESTAMP WITH TIME ZONE NOT NULL,
    idempotency_key TEXT UNIQUE,
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
