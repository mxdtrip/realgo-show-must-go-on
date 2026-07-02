BEGIN;

-- card_type_target_check references legacy type values (problem/pattern/concept)
-- which conflict with the current cards_type_check (pattern_recognition/algorithm_mechanics/edge_case).
-- Drop the stale constraint; keep the correct ones.
ALTER TABLE cards
  DROP CONSTRAINT IF EXISTS card_type_target_check;

COMMIT;
