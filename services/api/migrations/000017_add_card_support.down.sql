BEGIN;

-- Откат в обратном порядке
ALTER TABLE review_attempts DROP CONSTRAINT review_attempt_review_type_check;

ALTER TABLE review_schedules DROP CONSTRAINT problem_or_pattern_or_card_check;

ALTER TABLE review_schedules
  ADD CONSTRAINT problem_or_pattern_check
  CHECK (problem_id IS NOT NULL OR pattern_id IS NOT NULL);

ALTER TABLE review_schedules DROP COLUMN card_id;

COMMIT;
