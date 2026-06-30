BEGIN;

-- Откат review_attempts к состоянию после 000012: вернуть инлайн-имя CHECK,
-- двухсторонний XOR и таргет-констрейнт только на problem/pattern, затем
-- убрать card_id (его FK-зависимость снимется вместе с колонкой).
ALTER TABLE review_attempts
  DROP CONSTRAINT IF EXISTS review_attempt_review_type_check,
  DROP CONSTRAINT IF EXISTS exactly_one_review_attempt_target_check,
  DROP CONSTRAINT IF EXISTS review_attempt_type_target_check,
  ADD CONSTRAINT review_attempts_review_type_check
    CHECK (review_type IN ('problem', 'pattern')),
  ADD CONSTRAINT exactly_one_review_attempt_target_check
    CHECK ((problem_id IS NULL) <> (pattern_id IS NULL)),
  ADD CONSTRAINT review_attempt_type_target_check
    CHECK (
      (review_type = 'problem' AND problem_id IS NOT NULL AND pattern_id IS NULL)
      OR (review_type = 'pattern' AND pattern_id IS NOT NULL AND problem_id IS NULL)
    );

ALTER TABLE review_attempts DROP COLUMN IF EXISTS card_id;

-- Откат review_schedules к двухстороннему XOR.
ALTER TABLE review_schedules
  DROP CONSTRAINT IF EXISTS exactly_one_review_target_check,
  ADD CONSTRAINT exactly_one_review_target_check
    CHECK ((problem_id IS NULL) <> (pattern_id IS NULL));

ALTER TABLE review_schedules DROP COLUMN IF EXISTS card_id;

COMMIT;
