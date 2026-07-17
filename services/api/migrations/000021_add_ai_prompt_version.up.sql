BEGIN;

ALTER TABLE ai_request_logs
    ADD COLUMN prompt_version TEXT;

COMMIT;
