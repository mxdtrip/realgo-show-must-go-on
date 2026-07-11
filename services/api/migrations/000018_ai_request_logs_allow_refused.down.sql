BEGIN;

-- Preserve audit rows while mapping the new status back to the closest value
-- supported by the old constraint.
UPDATE ai_request_logs SET status = 'failed' WHERE status = 'refused';
ALTER TABLE ai_request_logs DROP CONSTRAINT ai_request_logs_status_check;
ALTER TABLE ai_request_logs
    ADD CONSTRAINT ai_request_logs_status_check
    CHECK (status IN ('queued', 'success', 'failed'));

COMMIT;
