BEGIN;

CREATE TABLE user_roadmap_configs (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_code TEXT,
    priority_mode TEXT NOT NULL DEFAULT 'balanced' CHECK (
        priority_mode IN ('balanced', 'easy_first', 'company_frequency', 'knowledge_gaps')
    ),
    horizon_weeks INTEGER NOT NULL CHECK (horizon_weeks BETWEEN 1 AND 52),
    weekly_capacity INTEGER NOT NULL DEFAULT 3 CHECK (weekly_capacity BETWEEN 1 AND 7),
    algorithm_version INTEGER NOT NULL DEFAULT 1 CHECK (algorithm_version > 0),
    source TEXT NOT NULL CHECK (source IN ('company', 'core')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roadmap_plan_items (
    user_id BIGINT NOT NULL REFERENCES user_roadmap_configs(user_id) ON DELETE CASCADE,
    subpattern_id BIGINT NOT NULL REFERENCES patterns(id) ON DELETE RESTRICT,
    week_index INTEGER NOT NULL CHECK (week_index BETWEEN 0 AND 52),
    position INTEGER NOT NULL CHECK (position > 0),
    selected BOOLEAN NOT NULL,
    PRIMARY KEY (user_id, subpattern_id),
    UNIQUE (user_id, position),
    CHECK ((selected AND week_index > 0) OR (NOT selected AND week_index = 0))
);

CREATE INDEX user_roadmap_plan_items_week_idx
    ON user_roadmap_plan_items (user_id, week_index, position);

COMMIT;
