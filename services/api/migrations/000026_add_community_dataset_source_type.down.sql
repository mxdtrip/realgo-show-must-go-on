-- 'community_dataset' rows cannot survive the narrower constraint.
DELETE FROM company_problems WHERE source_type = 'community_dataset';
ALTER TABLE company_problems DROP CONSTRAINT company_problems_source_type_check;
ALTER TABLE company_problems ADD CONSTRAINT company_problems_source_type_check
    CHECK (source_type IN ('demo', 'manual', 'community', 'dataset'));
