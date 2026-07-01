BEGIN;

-- 000018 switched cards.type to product contract values, but 000012 still left
-- card_type_target_check tied to legacy type values (problem/pattern/concept).
-- Card type now describes the learning mechanic, while problem_id/pattern_id
-- describes the optional source target.
ALTER TABLE cards
  DROP CONSTRAINT IF EXISTS card_type_target_check,
  DROP CONSTRAINT IF EXISTS cards_type_check,
  DROP CONSTRAINT IF EXISTS no_ambiguous_card_target_check;

UPDATE cards
SET type = CASE
  WHEN type IN ('problem', 'pattern', 'concept') THEN 'pattern_recognition'
  ELSE type
END;

ALTER TABLE cards
  ALTER COLUMN type SET NOT NULL,
  ADD CONSTRAINT cards_type_check
    CHECK (type IN ('pattern_recognition', 'algorithm_mechanics', 'edge_case')),
  ADD CONSTRAINT no_ambiguous_card_target_check
    CHECK (problem_id IS NULL OR pattern_id IS NULL);

COMMIT;
