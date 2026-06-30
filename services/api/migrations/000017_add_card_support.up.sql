BEGIN;

-- A1: Добавить card_id в review_schedules
ALTER TABLE review_schedules
  ADD COLUMN card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE;

-- A2: Обновить constraint (XOR на problem_id/pattern_id/card_id)
ALTER TABLE review_schedules
  DROP CONSTRAINT problem_or_pattern_check;

ALTER TABLE review_schedules
  ADD CONSTRAINT problem_or_pattern_or_card_check
  CHECK ((problem_id IS NOT NULL)::int + (pattern_id IS NOT NULL)::int + (card_id IS NOT NULL)::int = 1);

-- A3: Расширить review_type в review_attempts
ALTER TABLE review_attempts
  ADD CONSTRAINT review_attempt_review_type_check
  CHECK (review_type IN ('problem', 'pattern', 'card'));

-- A4: Добавить card_id в review_attempts
ALTER TABLE review_attempts
  ADD COLUMN card_id BIGINT REFERENCES cards(id) ON DELETE CASCADE;

COMMIT;
