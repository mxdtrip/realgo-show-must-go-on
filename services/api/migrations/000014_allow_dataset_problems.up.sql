-- Corpus problems imported from external datasets (e.g. the LeetCode primary
-- subpattern map) carry source_type = 'dataset', mirroring the label already
-- used by subpattern_companies / company_problems.
ALTER TABLE problems DROP CONSTRAINT problems_source_type_check;
ALTER TABLE problems ADD CONSTRAINT problems_source_type_check
    CHECK (source_type IN ('roadmap', 'manual', 'extension', 'ai', 'dataset'));
