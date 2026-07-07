-- Dataset-imported problems cannot survive the narrower constraint.
DELETE FROM problems WHERE source_type = 'dataset';
ALTER TABLE problems DROP CONSTRAINT problems_source_type_check;
ALTER TABLE problems ADD CONSTRAINT problems_source_type_check
    CHECK (source_type IN ('roadmap', 'manual', 'extension', 'ai'));
