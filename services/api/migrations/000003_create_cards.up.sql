BEGIN;

CREATE TABLE cards (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    problem_id BIGINT REFERENCES problems(id) ON DELETE CASCADE,
    pattern_id BIGINT REFERENCES patterns(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('pattern_recognition', 'algorithm_mechanics', 'edge_case')),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    explanation TEXT,
    source TEXT,
    created_by_ai BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT no_ambiguous_card_target_check CHECK (problem_id IS NULL OR pattern_id IS NULL)
);

COMMIT;
