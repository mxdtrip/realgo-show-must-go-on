CREATE TABLE IF NOT EXISTS platforms (
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
