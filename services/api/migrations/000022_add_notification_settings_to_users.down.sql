ALTER TABLE users
  DROP COLUMN IF EXISTS notify_review_reminder,
  DROP COLUMN IF EXISTS notify_weekly_digest,
  DROP COLUMN IF EXISTS notify_email_enabled;
