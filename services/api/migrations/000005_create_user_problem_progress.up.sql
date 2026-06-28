CREATE TABLE IF NOT EXISTS user_problem_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    status TEXT,
    rating INTEGER,
    first_seen_at TIMESTAMP WITH TIME ZONE,
    solved_at TIMESTAMP WITH TIME ZONE,
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    confidence INTEGER,
    notes TEXT,
    UNIQUE(user_id, problem_id)
);
