BEGIN;

-- Later down-migrations remove card_id and return review tables to
-- problem/pattern-only targets. Drop card review rows first so a full
-- migrate-down remains possible after demo card seeds have been loaded.
DELETE FROM review_attempts
WHERE card_id IS NOT NULL OR review_type = 'card';

DELETE FROM review_schedules
WHERE card_id IS NOT NULL;

ALTER TABLE cards
  DROP CONSTRAINT IF EXISTS card_type_target_check,
  DROP CONSTRAINT IF EXISTS cards_type_check,
  DROP CONSTRAINT IF EXISTS no_ambiguous_card_target_check;

UPDATE cards
SET type = CASE
  WHEN problem_id IS NOT NULL THEN 'problem'
  WHEN pattern_id IS NOT NULL THEN 'pattern'
  ELSE 'concept'
END;

ALTER TABLE cards
  ALTER COLUMN type SET NOT NULL,
  ADD CONSTRAINT cards_type_check
    CHECK (type IN ('problem', 'pattern', 'concept')),
  ADD CONSTRAINT no_ambiguous_card_target_check
    CHECK (problem_id IS NULL OR pattern_id IS NULL),
  ADD CONSTRAINT card_type_target_check
    CHECK (
      (type = 'problem' AND problem_id IS NOT NULL AND pattern_id IS NULL)
      OR (type = 'pattern' AND pattern_id IS NOT NULL AND problem_id IS NULL)
      OR (type = 'concept' AND problem_id IS NULL AND pattern_id IS NULL)
    );

COMMIT;
