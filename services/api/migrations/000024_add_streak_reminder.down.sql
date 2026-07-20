BEGIN;

ALTER TABLE users
    DROP COLUMN notify_streak_reminder;

COMMIT;
