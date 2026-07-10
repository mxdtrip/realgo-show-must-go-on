BEGIN;

DROP INDEX IF EXISTS ai_request_logs_hint_count_idx;
ALTER TABLE ai_request_logs DROP COLUMN IF EXISTS problem_id;
DROP TABLE IF EXISTS user_practice_patterns;

COMMIT;
