-- New evidence tier for company_problems: data collected from a single,
-- unverified-provenance scraper (see seed_community_company_problems.py),
-- distinct from both 'dataset' (cross-validated across independent public
-- repos) and 'community' (hand-curated, protected from re-seeds). Ranked
-- below both in trust — see the ON CONFLICT guards in seed_company_problems.py
-- and seed_gfg_company_problems.py, which now overwrite 'community_dataset'
-- rows the same way they already overwrite 'demo' fixtures.
ALTER TABLE company_problems DROP CONSTRAINT company_problems_source_type_check;
ALTER TABLE company_problems ADD CONSTRAINT company_problems_source_type_check
    CHECK (source_type IN ('demo', 'manual', 'community', 'dataset', 'community_dataset'));
