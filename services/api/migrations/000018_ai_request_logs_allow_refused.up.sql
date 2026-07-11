BEGIN;

-- CardProvisioner has always classified a model refusal (ErrUnknownProblem /
-- ErrQuotaExceeded) as status "refused" (internal/ai/provisioner.go
-- logAndClassify), but the CHECK constraint below only ever allowed
-- ('queued', 'success', 'failed'): every refusal silently failed to insert
-- into ai_request_logs, defeating "every LLM call visible in ai_request_logs".
ALTER TABLE ai_request_logs DROP CONSTRAINT ai_request_logs_status_check;
ALTER TABLE ai_request_logs
    ADD CONSTRAINT ai_request_logs_status_check
    CHECK (status IN ('queued', 'success', 'failed', 'refused'));

COMMIT;
