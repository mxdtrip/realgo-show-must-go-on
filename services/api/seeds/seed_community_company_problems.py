#!/usr/bin/env python3
"""Seed the community_dataset company<->problem evidence layer — a
lower-trust tier that supplements the primary LeetCode
(seed_company_problems.py) and GFG (seed_gfg_company_problems.py)
datasets, most importantly for companies with zero coverage there.

Takes ALL community_dataset CSVs at once (currently
atlas_community_company_problems.csv.gz from dr-o-ne and
atlas_researched_company_tasks.csv.gz from the hand-researched HackerRank-
task workbook — see the two build_*.py scripts for provenance of each).
This is not optional plumbing: every source shares source_type =
'community_dataset', and the rebuild for a platform deletes and re-inserts
ALL of that platform's community_dataset rows in one pass. Passing only one
source's CSV would delete every OTHER source's rows for that platform on
reseed, since the platform, not the originating file, is what scopes the
delete. Merging in Python first — rather than doing N independent passes —
is what keeps that rebuild atomic per platform.

Because none of these sources are cross-validated across independently
maintained repos the way the primary 'dataset' layer is, this layer does
NOT feed subpattern_companies relevance/confidence — those numbers stay
derived only from source_type = 'dataset' evidence (see
seed_company_problems.py). Companies seeded here simply show their problem
list without a relevance badge.

Precedence: 'community_dataset' sits BELOW every other tier. It only ever
overwrites 'demo' fixtures or its own prior rows — never 'manual',
'community', or 'dataset'. In the other direction, seed_company_problems.py
and seed_gfg_company_problems.py now overwrite 'community_dataset' rows the
same way they already overwrite 'demo': if a company later gets picked up
by the primary cross-validated sources, that evidence wins automatically on
the next reseed.

Idempotent: re-running with the same CSVs converges to the same state.

Usage:
  seed_community_company_problems.py atlas_community_company_problems.csv.gz \
      atlas_researched_company_tasks.csv.gz
  seed_community_company_problems.py --validate-only <csv> [<csv> ...]
"""
import argparse
import csv
import gzip
import os
import sys

DIFFICULTIES = {"easy", "medium", "hard", ""}
EXPECTED_HEADER = ["platform", "company_code", "company_name", "slug", "title",
                    "difficulty", "evidence_count", "last_seen", "sources", "problem_url"]


def load_rows(paths):
    rows = []
    seen = set()
    for path in paths:
        with gzip.open(path, "rt", newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader)
            if header != EXPECTED_HEADER:
                raise ValueError(f"{path}: unexpected header: {header}")
            for line in reader:
                (platform, code, name, slug, title, difficulty, evidence,
                 last_seen, sources, url) = line
                if not code.startswith("cmp_") or not name or not slug or not url:
                    raise ValueError(f"{path}: malformed row: {line}")
                if difficulty not in DIFFICULTIES:
                    raise ValueError(f"{path}: {code}/{slug}: invalid difficulty {difficulty}")
                pair = (platform, code, slug)
                if pair in seen:
                    raise ValueError(f"{path}: duplicate pair {pair} (check other input CSVs too)")
                seen.add(pair)
                rows.append({
                    "platform": platform,
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
    platforms = sorted({r["platform"] for r in rows})
    cur.execute("SELECT code, id FROM platforms WHERE code = ANY(%s)", (platforms,))
    platform_ids = dict(cur.fetchall())
    missing = set(platforms) - set(platform_ids)
    if missing:
        raise ValueError(f"unknown platform(s) {sorted(missing)}; run migrations first")

    cur.execute("""
        CREATE TEMP TABLE staging_community_company_problems (
            platform TEXT NOT NULL,
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
    with cur.copy("COPY staging_community_company_problems FROM STDIN") as copy:
        for r in rows:
            copy.write_row((r["platform"], r["code"], r["name"], r["slug"], r["title"],
                            r["url"], r["difficulty"], r["evidence"], r["last_seen"]))

    # ON CONFLICT DO UPDATE, not DO NOTHING: re-running with a refreshed CSV
    # must still relabel an existing 'demo' company row for real (albeit
    # single-source) evidence, mirroring the other two seeds. Never touches
    # a company row already backed by 'manual'/'community'/'dataset'.
    cur.execute("""
        INSERT INTO companies (code, name)
        SELECT DISTINCT ON (company_code) company_code, company_name
        FROM staging_community_company_problems
        ORDER BY company_code, company_name
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    """)

    problems_created = 0
    links = 0
    for platform in platforms:
        platform_id = platform_ids[platform]

        cur.execute("""
            INSERT INTO problems (platform_id, external_slug, title, url, difficulty, source_type)
            SELECT DISTINCT ON (s.slug)
                %s, s.slug, s.title, s.url, s.difficulty, 'dataset'
            FROM staging_community_company_problems s
            WHERE s.platform = %s
              AND NOT EXISTS (
                SELECT 1 FROM problems p
                WHERE p.platform_id = %s AND p.external_slug = s.slug
              )
            ORDER BY s.slug
        """, (platform_id, platform, platform_id))
        problems_created += cur.rowcount

        cur.execute("""
            DELETE FROM company_problems
            WHERE source_type = 'community_dataset'
              AND problem_id IN (SELECT id FROM problems WHERE platform_id = %s)
        """, (platform_id,))
        cur.execute("""
            INSERT INTO company_problems (company_id, problem_id, evidence_count, last_seen_at, source_type)
            SELECT co.id, p.id, s.evidence_count, s.last_seen, 'community_dataset'
            FROM staging_community_company_problems s
            JOIN companies co ON co.code = s.company_code
            JOIN problems p ON p.platform_id = %s AND p.external_slug = s.slug
            WHERE s.platform = %s
            ON CONFLICT (company_id, problem_id) DO UPDATE SET
                evidence_count = EXCLUDED.evidence_count,
                last_seen_at = EXCLUDED.last_seen_at,
                source_type = 'community_dataset'
            WHERE company_problems.source_type IN ('demo', 'community_dataset')
        """, (platform_id, platform))
        links += cur.rowcount

    return problems_created, links


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__,
                                      formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("datasets", nargs="+", help="one or more community_dataset CSVs")
    parser.add_argument("--validate-only", action="store_true", help="validate CSVs without Postgres")
    args = parser.parse_args(argv or sys.argv[1:])

    rows = load_rows(args.datasets)
    companies = len({r["code"] for r in rows})
    platforms = sorted({r["platform"] for r in rows})

    if args.validate_only:
        print(f"validated {len(rows)} community company-problem pairs across "
              f"{companies} companies on platforms {platforms}")
        return

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is required")

    import psycopg

    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                created, links = seed(cur, rows)

    print(f"seeded community company dataset: {companies} companies, {len(rows)} pairs "
          f"across {platforms} ({created} problems created, {links} evidence links)")


if __name__ == "__main__":
    main()
