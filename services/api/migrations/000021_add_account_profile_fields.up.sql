ALTER TABLE users
  ADD COLUMN IF NOT EXISTS prep_goal               VARCHAR(100),
  ADD COLUMN IF NOT EXISTS grade                   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS target_company          TEXT,
  ADD COLUMN IF NOT EXISTS target_position         TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notify_review_reminder  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_weekly_digest    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_email_enabled    BOOLEAN NOT NULL DEFAULT TRUE;
