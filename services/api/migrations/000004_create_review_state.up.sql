BEGIN;

CREATE TABLE user_problem_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    status VARCHAR(50) CHECK (status IN ('not_started', 'in_progress', 'solved', 'reviewing', 'skipped')),
    rating TEXT CHECK (rating IS NULL OR rating IN ('hard', 'normal', 'easy')),
    first_seen_at TIMESTAMPTZ,
    solved_at TIMESTAMPTZ,
    last_reviewed_at TIMESTAMPTZ,
    confidence INTEGER,
    note TEXT,
    UNIQUE (user_id, problem_id)
);

CREATE TABLE review_schedules (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id BIGINT REFERENCES problems(id) ON DELETE CASCADE,
    pattern_id BIGINT REFERENCES patterns(id) ON DELETE CASCADE,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    next_review_at TIMESTAMPTZ NOT NULL,
    interval_days DOUBLE PRECISION NOT NULL,
    ease DOUBLE PRECISION NOT NULL,
    stability DOUBLE PRECISION NOT NULL,
    difficulty DOUBLE PRECISION NOT NULL,
    review_count INTEGER DEFAULT 0,
    last_rating TEXT CHECK (last_rating IS NULL OR last_rating IN ('hard', 'normal', 'easy')),
    algorithm TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    state SMALLINT NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    last_review_at TIMESTAMPTZ,
    remaining_steps INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT exactly_one_review_target_check CHECK (
        (problem_id IS NOT NULL)::int + (pattern_id IS NOT NULL)::int + (card_id IS NOT NULL)::int = 1
    )
);

COMMENT ON COLUMN review_schedules.interval_days IS 'Current review interval length in days.';
COMMENT ON COLUMN review_schedules.ease IS 'Ease factor used by the spaced repetition algorithm.';
COMMENT ON COLUMN review_schedules.stability IS 'Memory stability coefficient used by the spaced repetition algorithm.';
COMMENT ON COLUMN review_schedules.difficulty IS 'Memory difficulty coefficient used by the spaced repetition algorithm.';
COMMENT ON COLUMN review_schedules.state IS 'FSRS card state: 0=New, 1=Learning, 2=Review, 3=Relearning';
COMMENT ON COLUMN review_schedules.lapses IS 'Number of times the card has been forgotten (FSRS Card.Lapses).';
COMMENT ON COLUMN review_schedules.last_review_at IS 'Timestamp of the last review (FSRS Card.LastReview).';
COMMENT ON COLUMN review_schedules.remaining_steps IS 'Remaining learning/relearning steps (FSRS Card.RemainingSteps).';

CREATE UNIQUE INDEX review_schedules_user_problem_unique
    ON review_schedules (user_id, problem_id)
    WHERE problem_id IS NOT NULL;

CREATE UNIQUE INDEX review_schedules_user_pattern_unique
    ON review_schedules (user_id, pattern_id)
    WHERE pattern_id IS NOT NULL;

CREATE UNIQUE INDEX review_schedules_user_card_unique
    ON review_schedules (user_id, card_id)
    WHERE card_id IS NOT NULL;

CREATE TABLE review_attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id BIGINT REFERENCES problems(id) ON DELETE CASCADE,
    pattern_id BIGINT REFERENCES patterns(id) ON DELETE CASCADE,
    card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE,
    rating TEXT NOT NULL CHECK (rating IN ('hard', 'normal', 'easy')),
    review_type VARCHAR(50) NOT NULL CHECK (review_type IN ('problem', 'pattern', 'card')),
    duration_sec INTEGER,
    was_correct BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT exactly_one_review_attempt_target_check CHECK (
        (problem_id IS NOT NULL)::int + (pattern_id IS NOT NULL)::int + (card_id IS NOT NULL)::int = 1
    ),
    CONSTRAINT review_attempt_type_target_check CHECK (
        (review_type = 'problem' AND problem_id IS NOT NULL AND pattern_id IS NULL AND card_id IS NULL)
        OR (review_type = 'pattern' AND pattern_id IS NOT NULL AND problem_id IS NULL AND card_id IS NULL)
        OR (review_type = 'card' AND card_id IS NOT NULL AND problem_id IS NULL AND pattern_id IS NULL)
    )
);

COMMIT;
