BEGIN;

-- No-op by design. Migration 000023 only removes the stale legacy
-- card_type_target_check after 000020 has already moved cards.type to contract
-- values (pattern_recognition/algorithm_mechanics/edge_case). Re-adding that
-- legacy constraint here makes a single-step rollback fail on valid current
-- card rows. Migration 000020.down converts rows back to legacy type values
-- and restores the old constraint during deeper rollbacks.

COMMIT;
