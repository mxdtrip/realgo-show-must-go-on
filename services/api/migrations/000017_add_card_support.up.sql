BEGIN;

-- A1: review_schedules — добавить card_id и расширить XOR до трёх таргетов.
-- 000012 переименовало старый problem_or_pattern_check в
-- exactly_one_review_target_check, поэтому работаем с актуальным именем.
ALTER TABLE review_schedules
  ADD COLUMN card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE;

ALTER TABLE review_schedules
  DROP CONSTRAINT IF EXISTS exactly_one_review_target_check,
  ADD CONSTRAINT exactly_one_review_target_check
    CHECK ((problem_id IS NOT NULL)::int + (pattern_id IS NOT NULL)::int + (card_id IS NOT NULL)::int = 1);

-- A2: review_attempts — добавить card_id, разрешить review_type='card' и
-- пересобрать таргет-констрейнты с учётом карточек. Снимаем как инлайн-CHECK
-- из 000007 (review_attempts_review_type_check), так и оба именованных из 000012.
ALTER TABLE review_attempts
  ADD COLUMN card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE;

ALTER TABLE review_attempts
  DROP CONSTRAINT IF EXISTS review_attempts_review_type_check,
  DROP CONSTRAINT IF EXISTS exactly_one_review_attempt_target_check,
  DROP CONSTRAINT IF EXISTS review_attempt_type_target_check,
  ADD CONSTRAINT review_attempt_review_type_check
    CHECK (review_type IN ('problem', 'pattern', 'card')),
  ADD CONSTRAINT exactly_one_review_attempt_target_check
    CHECK ((problem_id IS NOT NULL)::int + (pattern_id IS NOT NULL)::int + (card_id IS NOT NULL)::int = 1),
  ADD CONSTRAINT review_attempt_type_target_check
    CHECK (
      (review_type = 'problem' AND problem_id IS NOT NULL AND pattern_id IS NULL AND card_id IS NULL)
      OR (review_type = 'pattern' AND pattern_id IS NOT NULL AND problem_id IS NULL AND card_id IS NULL)
      OR (review_type = 'card' AND card_id IS NOT NULL AND problem_id IS NULL AND pattern_id IS NULL)
    );

COMMIT;
