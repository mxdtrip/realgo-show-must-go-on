BEGIN;

ALTER TABLE users
    ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- These reserved .test identities are the exact accounts owned by
-- seed_users.py in earlier releases. Mark them once so local reseeding stays
-- compatible while future conflicts with non-demo accounts fail closed.
UPDATE users
SET is_demo = TRUE
WHERE email IN ('tester@example.test', 'pro@example.test', 'admin@example.test');

COMMIT;
