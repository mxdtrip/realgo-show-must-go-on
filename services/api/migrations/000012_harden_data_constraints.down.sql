ALTER TABLE quiz_questions
    DROP CONSTRAINT IF EXISTS exactly_one_quiz_target_check;

ALTER TABLE cards
    DROP CONSTRAINT IF EXISTS card_type_target_check,
    DROP CONSTRAINT IF EXISTS no_ambiguous_card_target_check,
    ALTER COLUMN type DROP NOT NULL;

ALTER TABLE review_attempts
    DROP CONSTRAINT IF EXISTS review_attempt_type_target_check,
    DROP CONSTRAINT IF EXISTS exactly_one_review_attempt_target_check,
    ALTER COLUMN review_type DROP NOT NULL;

ALTER TABLE review_schedules
    DROP CONSTRAINT IF EXISTS exactly_one_review_target_check,
    ADD CONSTRAINT problem_or_pattern_check CHECK (problem_id IS NOT NULL OR pattern_id IS NOT NULL);

ALTER TABLE problems
    ALTER COLUMN platform_id DROP NOT NULL;
