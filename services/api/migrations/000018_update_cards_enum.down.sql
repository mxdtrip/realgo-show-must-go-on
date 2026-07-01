BEGIN;

-- Idempotent drops: a full `migrate down -all` runs 000020's down first, which
-- already restores the legacy cards_type_check/card_type_target_check pair. Use
-- IF EXISTS (matching this migration's up) so re-adding them here can't collide
-- with 000020's rollback.
ALTER TABLE cards
  DROP CONSTRAINT IF EXISTS cards_type_check,
  DROP CONSTRAINT IF EXISTS card_type_target_check;

UPDATE cards
  SET type = CASE
    WHEN problem_id IS NOT NULL THEN 'problem'
    WHEN pattern_id IS NOT NULL THEN 'pattern'
    ELSE 'concept'
  END;

ALTER TABLE cards
  ADD CONSTRAINT cards_type_check
  CHECK (type IN ('problem', 'pattern', 'concept')),
  ADD CONSTRAINT card_type_target_check CHECK (
    (type = 'problem' AND problem_id IS NOT NULL AND pattern_id IS NULL)
    OR
    (type = 'pattern' AND pattern_id IS NOT NULL AND problem_id IS NULL)
    OR
    (type = 'concept' AND problem_id IS NULL AND pattern_id IS NULL)
  );

COMMIT;
