BEGIN;

ALTER TABLE cards
  ADD CONSTRAINT card_type_target_check CHECK (
    (type = 'problem' AND problem_id IS NOT NULL AND pattern_id IS NULL)
    OR (type = 'pattern' AND pattern_id IS NOT NULL AND problem_id IS NULL)
    OR (type = 'concept' AND problem_id IS NULL AND pattern_id IS NULL)
  );

COMMIT;
