BEGIN;

ALTER TABLE cards ADD COLUMN ai_prompt_version TEXT;

-- Idempotency guard for CardProvisioner batch-insert: at most one global
-- (user_id IS NULL) AI-generated card per problem+type+prompt version, so a
-- retried or racing generation upserts instead of duplicating cards.
CREATE UNIQUE INDEX cards_ai_global_unique_idx
    ON cards (problem_id, type, ai_prompt_version)
    WHERE user_id IS NULL AND created_by_ai = TRUE AND problem_id IS NOT NULL;

COMMIT;
