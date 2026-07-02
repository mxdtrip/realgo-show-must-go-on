ALTER TABLE users
  DROP COLUMN IF EXISTS prep_goal,
  DROP COLUMN IF EXISTS grade,
  DROP COLUMN IF EXISTS target_company,
  DROP COLUMN IF EXISTS target_position,
  DROP COLUMN IF EXISTS onboarding_completed_at,
  DROP COLUMN IF EXISTS notify_review_reminder,
  DROP COLUMN IF EXISTS notify_weekly_digest,
  DROP COLUMN IF EXISTS notify_email_enabled;
