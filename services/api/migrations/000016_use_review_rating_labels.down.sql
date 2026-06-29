ALTER TABLE user_problem_progress
    DROP CONSTRAINT IF EXISTS user_problem_progress_rating_check,
    ALTER COLUMN rating TYPE INTEGER USING CASE rating
        WHEN 'easy' THEN 4
        WHEN 'normal' THEN 3
        WHEN 'hard' THEN 2
        ELSE NULL
    END;

ALTER TABLE extension_events
    DROP CONSTRAINT IF EXISTS extension_event_rating_check,
    ALTER COLUMN rating TYPE INTEGER USING CASE rating
        WHEN 'easy' THEN 4
        WHEN 'normal' THEN 3
        WHEN 'hard' THEN 2
        ELSE NULL
    END;

ALTER TABLE review_schedules
    DROP CONSTRAINT IF EXISTS review_schedule_last_rating_check,
    ALTER COLUMN last_rating TYPE INTEGER USING CASE last_rating
        WHEN 'easy' THEN 4
        WHEN 'normal' THEN 3
        WHEN 'hard' THEN 2
        ELSE NULL
    END;

ALTER TABLE review_attempts
    DROP CONSTRAINT IF EXISTS review_attempt_rating_check,
    ALTER COLUMN rating TYPE INTEGER USING CASE rating
        WHEN 'easy' THEN 4
        WHEN 'normal' THEN 3
        WHEN 'hard' THEN 2
        ELSE NULL
    END;
