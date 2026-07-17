BEGIN;

ALTER TABLE ai_request_logs
    DROP COLUMN IF EXISTS prompt_version;

COMMIT;
