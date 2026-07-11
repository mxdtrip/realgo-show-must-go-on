BEGIN;

DROP INDEX IF EXISTS cards_ai_global_unique_idx;
ALTER TABLE cards DROP COLUMN IF EXISTS ai_prompt_version;

COMMIT;
