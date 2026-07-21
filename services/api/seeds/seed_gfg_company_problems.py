#!/usr/bin/env python3
"""Seed the GeeksforGeeks company<->problem evidence dataset and refresh
per-subpattern company relevance for the Atlas company overlay.

Input: atlas_gfg_company_problems.csv.gz, collected from the public GFG
company-tags API (see services/api/seeds/README.md for collection notes).

Company codes are canonicalized here from the display name (not trusted
from the raw company_code column), using the same key scheme as
build_company_problems.py (LeetCode): lowercase, non-alnum runs collapsed
to underscores, cmp_ prefix, plus a small alias table. This makes a company
seen on both LeetCode and GFG (e.g. Amazon, Adobe) land on the SAME
`companies` row instead of creating a duplicate that would split its
evidence and relevance in two. CODE_ALIASES must stay in sync with
build_company_problems.py's ALIASES.

Mirrors seed_company_problems.py (LeetCode) in structure: same
company_problems / subpattern_companies rebuild strategy, so the two
scripts can run in either order without clobbering each other's evidence.
Each script's company_problems delete is scoped to its own platform;
subpattern_companies relevance is intentionally NOT platform-scoped — it is
derived from ALL platforms' dataset evidence combined, since "is this
subpattern relevant at company X" doesn't depend on which judge the
evidence came from.

Idempotent: re-running with the same CSV converges to the same state.

Usage:
  seed_gfg_company_problems.py atlas_gfg_company_problems.csv.gz
  seed_gfg_company_problems.py --validate-only atlas_gfg_company_problems.csv.gz
"""
import argparse
import csv
import gzip
import os
import re
import sys

DIFFICULTIES = {"easy", "medium", "hard", ""}
EXPECTED_HEADER = ["company_code", "company_name", "slug", "title", "difficulty",
                    "evidence_count", "last_seen", "sources", "problem_url"]

# Keep in sync with build_company_problems.py's ALIASES.
CODE_ALIASES = {
    "facebook": "meta",
    "d e shaw": "de shaw",  # GFG lists "D-E-Shaw" and "DE Shaw" as separate tags
}


def norm_code(company_name):
    key = re.sub(r"[^a-z0-9]+", " ", company_name.lower()).strip()
    key = CODE_ALIASES.get(key, key)
    return "cmp_" + re.sub(r"\s+", "_", key)


def load_rows(path):
    with gzip.open(path, "rt", newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader)
        if header != EXPECTED_HEADER:
            raise ValueError(f"unexpected header: {header}")
        rows = []
        seen = set()
        for line in reader:
            (raw_code, name, slug, title, difficulty, evidence, last_seen,
             sources, url) = line
            if not raw_code or not name or not slug or not url:
                raise ValueError(f"malformed row: {line}")
            difficulty = difficulty.strip().lower()
            if difficulty not in DIFFICULTIES:
                raise ValueError(f"{raw_code}/{slug}: invalid difficulty {difficulty!r}")
            code = norm_code(name)
            if (code, slug) in seen:
                raise ValueError(f"duplicate pair {code}/{slug} (company merge collision)")
            seen.add((code, slug))
            rows.append({
                "code": code,
                "name": name,
                "slug": slug,
                "title": title or slug,
                "url": url,
                "difficulty": difficulty or None,
                "evidence": int(evidence),
                "last_seen": last_seen or None,
            })
        return rows


def seed(cur, rows):
    cur.execute("SELECT id FROM platforms WHERE code = 'geeksforgeeks'")
    platform = cur.fetchone()
    if not platform:
        raise ValueError("platform 'geeksforgeeks' is missing; run migrations first")
    platform_id = platform[0]

    cur.execute("""
        CREATE TEMP TABLE staging_gfg_company_problems (
            company_code TEXT NOT NULL,
            company_name TEXT NOT NULL,
            slug TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            difficulty TEXT,
            evidence_count INTEGER NOT NULL,
            last_seen DATE
        ) ON COMMIT DROP
    """)
    with cur.copy("COPY staging_gfg_company_problems FROM STDIN") as copy:
        for r in rows:
            copy.write_row((r["code"], r["name"], r["slug"], r["title"], r["url"],
                            r["difficulty"], r["evidence"], r["last_seen"]))

    # DISTINCT ON, not DISTINCT: two raw GFG names can canonicalize onto the
    # same company_code (e.g. "D-E-Shaw" / "DE Shaw" -> cmp_de_shaw), and a
    # plain DISTINCT over both columns would keep both, making ON CONFLICT
    # DO UPDATE hit that code twice in the same command (CardinalityViolation).
    cur.execute("""
        INSERT INTO companies (code, name)
        SELECT DISTINCT ON (company_code) company_code, company_name
        FROM staging_gfg_company_problems
        ORDER BY company_code, company_name
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    """)

    cur.execute("""
        INSERT INTO problems (platform_id, external_slug, title, url, difficulty, source_type)
        SELECT DISTINCT ON (s.slug)
            %s, s.slug, s.title, s.url, s.difficulty, 'dataset'
        FROM staging_gfg_company_problems s
        WHERE NOT EXISTS (
            SELECT 1 FROM problems p
            WHERE p.platform_id = %s AND p.external_slug = s.slug
        )
        ORDER BY s.slug
    """, (platform_id, platform_id))
    problems_created = cur.rowcount

    # Scoped to this platform only: seed_company_problems.py (LeetCode) rebuilds
    # the same 'dataset' layer for its own platform independently, and each
    # must not delete the other's rows.
    cur.execute("""
        DELETE FROM company_problems
        WHERE source_type = 'dataset'
          AND problem_id IN (SELECT id FROM problems WHERE platform_id = %s)
    """, (platform_id,))
    cur.execute("""
        INSERT INTO company_problems (company_id, problem_id, evidence_count, last_seen_at, source_type)
        SELECT co.id, p.id, s.evidence_count, s.last_seen, 'dataset'
        FROM staging_gfg_company_problems s
        JOIN companies co ON co.code = s.company_code
        JOIN problems p ON p.platform_id = %s AND p.external_slug = s.slug
        ON CONFLICT (company_id, problem_id) DO UPDATE SET
            evidence_count = EXCLUDED.evidence_count,
            last_seen_at = EXCLUDED.last_seen_at,
            source_type = 'dataset'
        WHERE company_problems.source_type = 'demo'
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
    parser.add_argument("dataset", help="atlas_gfg_company_problems.csv.gz")
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

    print(f"seeded gfg company dataset: {companies} companies, {len(rows)} pairs "
          f"({created} problems created, {links} evidence links, {relevance} relevance rows)")


if __name__ == "__main__":
    main()
