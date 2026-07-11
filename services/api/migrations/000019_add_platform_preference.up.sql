BEGIN;

-- Register the two platforms the web onboarding/settings selector already
-- offers as placeholders (GeeksforGeeks integration in progress, Codeforces
-- reserved for later). LeetCode/HackerRank already exist since 000002.
INSERT INTO platforms (code, name, base_url) VALUES
    ('geeksforgeeks', 'GeeksforGeeks', 'https://www.geeksforgeeks.org'),
    ('codeforces', 'Codeforces', 'https://codeforces.com')
ON CONFLICT (code) DO NOTHING;

-- User-level practice platform preference, set in onboarding/settings.
-- Kept as a plain checked column (like `grade`) rather than a FK to
-- `platforms`: `platforms` enumerates where *problems* come from, this is
-- the user's stated primary platform and may be set before any problem from
-- that platform exists in the catalog.
ALTER TABLE users ADD COLUMN platform VARCHAR(30)
    CHECK (platform IN ('leetcode', 'geeksforgeeks', 'hackerrank', 'codeforces'));

COMMIT;
