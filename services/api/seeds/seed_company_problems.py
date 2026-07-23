#!/usr/bin/env python3
"""Seed the company<->problem evidence dataset and derive per-subpattern
company relevance for the Atlas company overlay.

Input: atlas_company_problems.csv.gz built by build_company_problems.py from
public LeetCode company-wise repos (source_type = dataset).

What it does, in one transaction:
 1. upserts companies (code, name);
 2. inserts LeetCode problems missing from the catalog (slug/title/difficulty,
    source_type = dataset) — existing rows are never modified;
 3. rebuilds the dataset layer of company_problems (delete + insert), keeping
    demo/manual/community rows intact;
 4. rebuilds the dataset layer of subpattern_companies: relevance is DERIVED
    from evidence through problem_subpatterns links, never hand-assigned:
       relevance   high >= 5 linked problems, medium >= 2, low = 1
       confidence  high >= 10 total evidence, medium >= 4, low otherwise
    On (subpattern, company) collisions the dataset row replaces a demo row
    (real evidence beats fixtures) but never a manual/community one.

On company_problems specifically, this cross-validated dataset layer also
replaces 'community_dataset' rows (see seed_community_company_problems.py) —
that layer is single-source and unverified, so real multi-source evidence
always wins when a company graduates into this dataset.

Idempotent: re-running with the same CSV converges to the same state.

Usage:
  seed_company_problems.py atlas_company_problems.csv.gz
  seed_company_problems.py --validate-only atlas_company_problems.csv.gz
"""
import argparse
import csv
import gzip
import os
import sys

DIFFICULTIES = {"easy", "medium", "hard", ""}
EXPECTED_HEADER = ["company_code", "company_name", "slug", "title", "difficulty",
                   "evidence_count", "last_seen", "sources"]


def load_rows(path):
    with gzip.open(path, "rt", newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        if header != EXPECTED_HEADER:
            raise ValueError(f"unexpected header: {header}")
        rows = []
        seen = set()
        for line in reader:
            code, name, slug, title, difficulty, evidence, last_seen, sources = line
            if not code.startswith("cmp_") or not name or not slug:
                raise ValueError(f"malformed row: {line}")
            if difficulty not in DIFFICULTIES:
                raise ValueError(f"{code}/{slug}: invalid difficulty {difficulty}")
            if (code, slug) in seen:
                raise ValueError(f"duplicate pair {code}/{slug}")
            seen.add((code, slug))
            rows.append({
                "code": code,
                "name": name,
                "slug": slug,
                "title": title or slug,
                "difficulty": difficulty or None,
                "evidence": int(evidence),
                "last_seen": last_seen or None,
            })
        return rows


def seed(cur, rows):
    cur.execute("SELECT id FROM platforms WHERE code = 'leetcode'")
    platform = cur.fetchone()
    if not platform:
        raise ValueError("platform 'leetcode' is missing; run migrations first")
    platform_id = platform[0]

    cur.execute("""
        CREATE TEMP TABLE staging_company_problems (
            company_code TEXT NOT NULL,
            company_name TEXT NOT NULL,
            slug TEXT NOT NULL,
            title TEXT NOT NULL,
            difficulty TEXT,
            evidence_count INTEGER NOT NULL,
            last_seen DATE
        ) ON COMMIT DROP
    """)
    with cur.copy("COPY staging_company_problems FROM STDIN") as copy:
        for r in rows:
            copy.write_row((r["code"], r["name"], r["slug"], r["title"],
                            r["difficulty"], r["evidence"], r["last_seen"]))

    cur.execute("""
        INSERT INTO companies (code, name)
        SELECT DISTINCT company_code, company_name FROM staging_company_problems
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    """)

    cur.execute("""
        INSERT INTO problems (platform_id, external_slug, title, url, difficulty, source_type)
        SELECT DISTINCT ON (s.slug)
            %s, s.slug, s.title,
            'https://leetcode.com/problems/' || s.slug || '/',
            s.difficulty, 'dataset'
        FROM staging_company_problems s
        WHERE NOT EXISTS (
            SELECT 1 FROM problems p
            WHERE p.platform_id = %s AND p.external_slug = s.slug
        )
        ORDER BY s.slug
    """, (platform_id, platform_id))
    problems_created = cur.rowcount

    # The dataset layer is rebuilt wholesale so removed evidence does not
    # linger; other source_types are never touched. Scoped to this platform
    # only: seed_gfg_company_problems.py rebuilds the same 'dataset' layer
    # for its own platform independently, and each must not delete the
    # other's rows.
    cur.execute("""
        DELETE FROM company_problems
        WHERE source_type = 'dataset'
          AND problem_id IN (SELECT id FROM problems WHERE platform_id = %s)
    """, (platform_id,))
    cur.execute("""
        INSERT INTO company_problems (company_id, problem_id, evidence_count, last_seen_at, source_type)
        SELECT co.id, p.id, s.evidence_count, s.last_seen, 'dataset'
        FROM staging_company_problems s
        JOIN companies co ON co.code = s.company_code
        JOIN problems p ON p.platform_id = %s AND p.external_slug = s.slug
        ON CONFLICT (company_id, problem_id) DO UPDATE SET
            evidence_count = EXCLUDED.evidence_count,
            last_seen_at = EXCLUDED.last_seen_at,
            source_type = 'dataset'
        WHERE company_problems.source_type IN ('demo', 'community_dataset')
    """, (platform_id,))
    links = cur.rowcount

    # Not platform-scoped: relevance combines dataset evidence from every
    # platform currently in company_problems (LeetCode + GFG + future ones).
    cur.execute("DELETE FROM subpattern_companies WHERE source_type = 'dataset'")
    cur.execute("""
        INSERT INTO subpattern_companies
            (subpattern_id, company_id, relevance, confidence, evidence_count, last_seen_at, source_type)
        SELECT
            ps.subpattern_id,
            cp.company_id,
            CASE WHEN COUNT(DISTINCT cp.problem_id) >= 5 THEN 'high'
                 WHEN COUNT(DISTINCT cp.problem_id) >= 2 THEN 'medium'
                 ELSE 'low' END,
            CASE WHEN SUM(cp.evidence_count) >= 10 THEN 'high'
                 WHEN SUM(cp.evidence_count) >= 4 THEN 'medium'
                 ELSE 'low' END,
            SUM(cp.evidence_count)::integer,
            MAX(cp.last_seen_at),
            'dataset'
        FROM company_problems cp
        JOIN problem_subpatterns ps ON ps.problem_id = cp.problem_id
        JOIN patterns sp ON sp.id = ps.subpattern_id
            AND sp.kind = 'subpattern' AND sp.taxonomy_version = 'realgo-v2'
        WHERE cp.source_type = 'dataset'
        GROUP BY ps.subpattern_id, cp.company_id
        ON CONFLICT (subpattern_id, company_id) DO UPDATE SET
            relevance = EXCLUDED.relevance,
            confidence = EXCLUDED.confidence,
            evidence_count = EXCLUDED.evidence_count,
            last_seen_at = EXCLUDED.last_seen_at,
            source_type = 'dataset'
        WHERE subpattern_companies.source_type = 'demo'
    """)
    relevance_rows = cur.rowcount
    return problems_created, links, relevance_rows


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", help="atlas_company_problems.csv.gz")
    parser.add_argument("--validate-only", action="store_true", help="validate CSV without Postgres")
    args = parser.parse_args(argv or sys.argv[1:])

    rows = load_rows(args.dataset)
    companies = len({r["code"] for r in rows})

    if args.validate_only:
        print(f"validated {len(rows)} company-problem pairs across {companies} companies")
        return

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is required")

    import psycopg

    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                created, links, relevance = seed(cur, rows)

    print(f"seeded company dataset: {companies} companies, {len(rows)} pairs "
          f"({created} problems created, {links} evidence links, {relevance} relevance rows)")


if __name__ == "__main__":
    main()
