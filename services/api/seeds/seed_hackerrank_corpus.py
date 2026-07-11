#!/usr/bin/env python3
"""Seed the Realgo HackerRank interview corpus (official Interview
Preparation Kits) and primary problem<->subpattern links.

Import rules follow realgo_hackerrank_interview_mapping.md:
 - one problems row per distinct HackerRank slug (kit memberships stay in
   the YAML as source metadata, they never create duplicate rows);
 - only mapping_status = mapped rows get a subpattern link; gap_candidate
   (HRX-*) and non_pattern rows are inserted WITHOUT links — force-mapping
   is forbidden until the cross-platform gap review;
 - curated links (tier IS NOT NULL) stay authoritative — only corpus links
   (tier IS NULL) refresh their position on re-seed.

Usage:
  seed_hackerrank_corpus.py atlas_hackerrank_problems.yaml
  seed_hackerrank_corpus.py --validate-only atlas_hackerrank_problems.yaml
"""
import argparse
import os
import sys
from pathlib import Path

import yaml


STATUSES = {"mapped", "gap_candidate", "non_pattern"}


def require(mapping, key, where):
    value = mapping.get(key)
    if value in (None, ""):
        raise ValueError(f"{where}: missing {key}")
    return value


def load_corpus(path):
    data = yaml.safe_load(Path(path).read_text())
    if not isinstance(data, dict):
        raise ValueError(f"{path}: manifest must be a mapping")
    if data.get("platform") != "hackerrank":
        raise ValueError(f"{path}: expected platform: hackerrank")
    problems = require(data, "problems", "corpus manifest")
    if not isinstance(problems, list):
        raise ValueError(f"{path}: problems must be a list")

    rows = []
    seen_slugs = set()
    link_position = {}
    for item in problems:
        slug = require(item, "slug", "corpus problem")
        if slug in seen_slugs:
            raise ValueError(f"duplicate slug: {slug}")
        seen_slugs.add(slug)
        status = require(item, "mapping_status", f"corpus {slug}")
        if status not in STATUSES:
            raise ValueError(f"corpus {slug}: invalid mapping_status {status}")
        subpattern = item.get("subpattern")
        if status == "mapped" and not subpattern:
            raise ValueError(f"corpus {slug}: mapped without subpattern")
        if status != "mapped" and subpattern:
            raise ValueError(f"corpus {slug}: {status} must not carry a subpattern (no force-mapping)")
        if status == "gap_candidate" and not item.get("extension_id", "").startswith("HRX-"):
            raise ValueError(f"corpus {slug}: gap_candidate needs an HRX-* extension_id")
        row = {
            "slug": slug,
            "title": require(item, "title", f"corpus {slug}"),
            "url": require(item, "url", f"corpus {slug}"),
            "subpattern": subpattern,
        }
        if subpattern:
            link_position[subpattern] = link_position.get(subpattern, 0) + 1
            row["position"] = link_position[subpattern]
        rows.append(row)
    return rows


def resolve_subpatterns(cur, codes):
    cur.execute(
        "SELECT code, id FROM patterns WHERE kind = 'subpattern' AND code = ANY(%s)",
        (sorted(codes),),
    )
    found = dict(cur.fetchall())
    missing = sorted(set(codes) - set(found))
    if missing:
        raise ValueError("missing subpatterns (run migrations first): " + ", ".join(missing))
    return found


def upsert_corpus(cur, rows):
    subpattern_ids = resolve_subpatterns(
        cur, {r["subpattern"] for r in rows if r["subpattern"]}
    )

    cur.execute("SELECT id FROM platforms WHERE code = 'hackerrank'")
    platform = cur.fetchone()
    if not platform:
        raise ValueError("platform 'hackerrank' is missing; run migrations first")
    platform_id = platform[0]

    inserted = 0
    linked = 0
    for row in rows:
        cur.execute(
            """
            INSERT INTO problems (
                platform_id, external_slug, title, url, source_type
            ) VALUES (%s, %s, %s, %s, 'dataset')
            ON CONFLICT (platform_id, external_slug) DO UPDATE SET
                title = EXCLUDED.title,
                url = EXCLUDED.url,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, (xmax = 0)
            """,
            (platform_id, row["slug"], row["title"], row["url"]),
        )
        problem_id, is_insert = cur.fetchone()
        if is_insert:
            inserted += 1

        if not row["subpattern"]:
            continue
        cur.execute(
            """
            INSERT INTO problem_subpatterns (problem_id, subpattern_id, tier, position)
            VALUES (%s, %s, NULL, %s)
            ON CONFLICT (problem_id, subpattern_id) DO UPDATE SET
                position = EXCLUDED.position
            WHERE problem_subpatterns.tier IS NULL
            """,
            (problem_id, subpattern_ids[row["subpattern"]], row["position"]),
        )
        linked += cur.rowcount
    return inserted, linked


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("corpus", help="HackerRank corpus YAML")
    parser.add_argument("--validate-only", action="store_true", help="validate YAML without Postgres")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    rows = load_corpus(args.corpus)
    linkable = sum(1 for r in rows if r["subpattern"])

    if args.validate_only:
        print(f"validated {len(rows)} corpus problems ({linkable} linkable)")
        return

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is required")

    import psycopg

    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                inserted, linked = upsert_corpus(cur, rows)

    print(f"seeded hackerrank corpus: {len(rows)} problems ({inserted} new), {linked} links written")


if __name__ == "__main__":
    main()
