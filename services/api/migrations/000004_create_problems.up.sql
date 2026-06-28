CREATE TABLE IF NOT EXISTS problems (
    id BIGSERIAL PRIMARY KEY,
    platform_id BIGINT REFERENCES platforms(id) ON DELETE CASCADE,
    external_slug TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    difficulty TEXT,
    source_type TEXT,
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform_id, external_slug)
);
