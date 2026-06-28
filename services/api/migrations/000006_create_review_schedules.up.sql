CREATE TABLE IF NOT EXISTS review_schedules (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id BIGINT REFERENCES problems(id) ON DELETE CASCADE,
    pattern_id BIGINT REFERENCES patterns(id) ON DELETE CASCADE,
    next_review_at TIMESTAMP WITH TIME ZONE NOT NULL,
    interval_days DOUBLE PRECISION NOT NULL,
    ease DOUBLE PRECISION NOT NULL,
    stability DOUBLE PRECISION NOT NULL,
    difficulty DOUBLE PRECISION NOT NULL,
    review_count INTEGER DEFAULT 0,
    last_rating INTEGER,
    algorithm TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT problem_or_pattern_check CHECK (problem_id IS NOT NULL OR pattern_id IS NOT NULL)
);

COMMENT ON COLUMN review_schedules.interval_days IS 'Current review interval length in days.';
COMMENT ON COLUMN review_schedules.ease IS 'Ease factor used by the spaced repetition algorithm.';
COMMENT ON COLUMN review_schedules.stability IS 'Memory stability coefficient used by the spaced repetition algorithm.';
COMMENT ON COLUMN review_schedules.difficulty IS 'Memory difficulty coefficient used by the spaced repetition algorithm.';
