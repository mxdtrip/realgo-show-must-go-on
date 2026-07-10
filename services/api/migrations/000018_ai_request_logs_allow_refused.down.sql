BEGIN;

-- Reverting to the narrower constraint would fail if any 'refused' rows were
-- written while this migration was applied; that data loss risk belongs to
-- whoever runs the rollback, same as any other constraint-narrowing down.
DELETE FROM ai_request_logs WHERE status = 'refused';
ALTER TABLE ai_request_logs DROP CONSTRAINT ai_request_logs_status_check;
ALTER TABLE ai_request_logs
    ADD CONSTRAINT ai_request_logs_status_check
    CHECK (status IN ('queued', 'success', 'failed'));

COMMIT;
