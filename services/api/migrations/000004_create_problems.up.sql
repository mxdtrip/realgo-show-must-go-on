CREATE TABLE IF NOT EXISTS problems (
    id BIGSERIAL PRIMARY KEY,
    platform_id BIGINT REFERENCES platforms(id) ON DELETE CASCADE,
    external_slug TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),
    source_type VARCHAR(50) CHECK (source_type IN ('roadmap', 'manual', 'extension', 'ai')),
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform_id, external_slug)
);
