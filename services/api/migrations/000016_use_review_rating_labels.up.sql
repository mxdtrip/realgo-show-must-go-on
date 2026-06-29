ALTER TABLE review_attempts
    ALTER COLUMN rating TYPE TEXT USING CASE rating
        WHEN 4 THEN 'easy'
        WHEN 3 THEN 'normal'
        ELSE 'hard'
    END,
    ADD CONSTRAINT review_attempt_rating_check CHECK (rating IN ('hard', 'normal', 'easy'));

ALTER TABLE review_schedules
    ALTER COLUMN last_rating TYPE TEXT USING CASE
        WHEN last_rating IS NULL THEN NULL
        WHEN last_rating = 4 THEN 'easy'
        WHEN last_rating = 3 THEN 'normal'
        ELSE 'hard'
    END,
    ADD CONSTRAINT review_schedule_last_rating_check CHECK (last_rating IS NULL OR last_rating IN ('hard', 'normal', 'easy'));

ALTER TABLE extension_events
    ALTER COLUMN rating TYPE TEXT USING CASE
        WHEN rating IS NULL THEN NULL
        WHEN rating = 4 THEN 'easy'
        WHEN rating = 3 THEN 'normal'
        ELSE 'hard'
    END,
    ADD CONSTRAINT extension_event_rating_check CHECK (rating IS NULL OR rating IN ('hard', 'normal', 'easy'));

ALTER TABLE user_problem_progress
    ALTER COLUMN rating TYPE TEXT USING CASE
        WHEN rating IS NULL THEN NULL
        WHEN rating = 4 THEN 'easy'
        WHEN rating = 3 THEN 'normal'
        ELSE 'hard'
    END,
    ADD CONSTRAINT user_problem_progress_rating_check CHECK (rating IS NULL OR rating IN ('hard', 'normal', 'easy'));
