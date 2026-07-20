BEGIN;

-- The weekly digest is a promotional-style email, not a core spaced-repetition
-- reminder — new accounts should not be silently opted in before they've
-- consented to anything (registration now requires accepting the Privacy
-- Policy, which discloses this, but the digest itself stays opt-in).
ALTER TABLE users
    ALTER COLUMN notify_weekly_digest SET DEFAULT FALSE;

COMMIT;
