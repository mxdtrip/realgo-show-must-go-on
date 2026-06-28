CREATE TABLE IF NOT EXISTS patterns (
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
