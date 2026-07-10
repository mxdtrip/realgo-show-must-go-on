BEGIN;

CREATE UNIQUE INDEX cards_ai_global_unique_idx
    ON cards (problem_id, type, ai_prompt_version)
    WHERE user_id IS NULL AND created_by_ai = TRUE AND problem_id IS NOT NULL;

DROP INDEX IF EXISTS cards_source_global_unique_idx;

-- The duplicate-source repair above is irreversible: the removed rows are
-- not preserved.

COMMIT;
