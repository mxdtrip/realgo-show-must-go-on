ALTER TABLE review_schedules
    DROP COLUMN IF EXISTS state,
    DROP COLUMN IF EXISTS lapses,
    DROP COLUMN IF EXISTS last_review_at,
    DROP COLUMN IF EXISTS remaining_steps;
