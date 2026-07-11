BEGIN;

CREATE TABLE platforms (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    base_url TEXT NOT NULL
);

INSERT INTO platforms (code, name, base_url) VALUES
    ('leetcode', 'LeetCode', 'https://leetcode.com'),
    ('neetcode', 'NeetCode', 'https://neetcode.io'),
    ('hackerrank', 'HackerRank', 'https://www.hackerrank.com'),
    ('generic', 'Generic', '');

CREATE TABLE patterns (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id BIGINT REFERENCES patterns(id) ON DELETE SET NULL
);

INSERT INTO patterns (code, name) VALUES
    ('two_pointers', 'Two Pointers'),
    ('sliding_window', 'Sliding Window'),
    ('binary_search', 'Binary Search'),
    ('bfs', 'Breadth-First Search'),
    ('dfs', 'Depth-First Search'),
    ('dynamic_programming', 'Dynamic Programming'),
    ('heap', 'Heap'),
    ('intervals', 'Intervals'),
    ('backtracking', 'Backtracking');

CREATE TABLE problems (
    id BIGSERIAL PRIMARY KEY,
    platform_id BIGINT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
    external_slug TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),
    source_type VARCHAR(50) CHECK (source_type IN ('roadmap', 'manual', 'extension', 'ai')),
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    external_id TEXT,
    UNIQUE (platform_id, external_slug)
);

CREATE TABLE roadmap_items (
    roadmap_code TEXT NOT NULL,
    pattern_id BIGINT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    PRIMARY KEY (roadmap_code, problem_id)
);

CREATE UNIQUE INDEX roadmap_items_roadmap_code_position_idx
    ON roadmap_items (roadmap_code, position);

COMMIT;
