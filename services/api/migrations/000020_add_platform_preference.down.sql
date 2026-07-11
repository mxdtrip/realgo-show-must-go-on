BEGIN;

ALTER TABLE users DROP COLUMN platform;

DELETE FROM platforms WHERE code IN ('geeksforgeeks', 'codeforces');

COMMIT;
