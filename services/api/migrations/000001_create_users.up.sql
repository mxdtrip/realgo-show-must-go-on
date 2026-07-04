BEGIN;

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    plan VARCHAR(50) DEFAULT 'free',
    interview_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    prep_goal VARCHAR(100),
    grade VARCHAR(50),
    target_company TEXT,
    target_position TEXT,
    onboarding_completed_at TIMESTAMPTZ,
    notify_review_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    notify_weekly_digest BOOLEAN NOT NULL DEFAULT TRUE,
    notify_email_enabled BOOLEAN NOT NULL DEFAULT TRUE
);

COMMIT;
