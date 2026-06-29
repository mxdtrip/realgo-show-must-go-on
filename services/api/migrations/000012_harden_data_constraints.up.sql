WITH generic_platform AS (
    INSERT INTO platforms (code, name, base_url)
    VALUES ('generic', 'Generic', '')
    ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name
    RETURNING id
)
UPDATE problems
SET platform_id = (SELECT id FROM generic_platform)
WHERE platform_id IS NULL;

ALTER TABLE problems
    ALTER COLUMN platform_id SET NOT NULL;

UPDATE review_schedules
SET pattern_id = NULL
WHERE problem_id IS NOT NULL
  AND pattern_id IS NOT NULL;

ALTER TABLE review_schedules
    DROP CONSTRAINT IF EXISTS problem_or_pattern_check,
    ADD CONSTRAINT exactly_one_review_target_check CHECK ((problem_id IS NULL) <> (pattern_id IS NULL));

DELETE FROM review_attempts
WHERE problem_id IS NULL
  AND pattern_id IS NULL;

UPDATE review_attempts
SET pattern_id = NULL
WHERE problem_id IS NOT NULL
  AND pattern_id IS NOT NULL;

UPDATE review_attempts
SET review_type = CASE
    WHEN problem_id IS NOT NULL THEN 'problem'
    ELSE 'pattern'
END
WHERE review_type IS NULL
   OR (review_type = 'problem' AND problem_id IS NULL)
   OR (review_type = 'pattern' AND pattern_id IS NULL);

ALTER TABLE review_attempts
    ALTER COLUMN review_type SET NOT NULL,
    ADD CONSTRAINT exactly_one_review_attempt_target_check CHECK ((problem_id IS NULL) <> (pattern_id IS NULL)),
    ADD CONSTRAINT review_attempt_type_target_check CHECK (
        (review_type = 'problem' AND problem_id IS NOT NULL AND pattern_id IS NULL)
        OR
        (review_type = 'pattern' AND pattern_id IS NOT NULL AND problem_id IS NULL)
    );

UPDATE cards
SET pattern_id = NULL
WHERE problem_id IS NOT NULL
  AND pattern_id IS NOT NULL;

UPDATE cards
SET type = CASE
    WHEN problem_id IS NOT NULL THEN 'problem'
    WHEN pattern_id IS NOT NULL THEN 'pattern'
    ELSE 'concept'
END
WHERE type IS NULL
   OR (type = 'problem' AND problem_id IS NULL)
   OR (type = 'pattern' AND pattern_id IS NULL)
   OR (type = 'concept' AND (problem_id IS NOT NULL OR pattern_id IS NOT NULL));

ALTER TABLE cards
    ALTER COLUMN type SET NOT NULL,
    ADD CONSTRAINT no_ambiguous_card_target_check CHECK (problem_id IS NULL OR pattern_id IS NULL),
    ADD CONSTRAINT card_type_target_check CHECK (
        (type = 'problem' AND problem_id IS NOT NULL AND pattern_id IS NULL)
        OR
        (type = 'pattern' AND pattern_id IS NOT NULL AND problem_id IS NULL)
        OR
        (type = 'concept' AND problem_id IS NULL AND pattern_id IS NULL)
    );

DELETE FROM quiz_questions
WHERE problem_id IS NULL
  AND pattern_id IS NULL;

UPDATE quiz_questions
SET pattern_id = NULL
WHERE problem_id IS NOT NULL
  AND pattern_id IS NOT NULL;

ALTER TABLE quiz_questions
    ADD CONSTRAINT exactly_one_quiz_target_check CHECK ((problem_id IS NULL) <> (pattern_id IS NULL));
