#!/usr/bin/env python3
"""Seed the Realgo Codeforces corpus: dataset-imported problems and their
primary problem<->subpattern links, WITH an explicit tier.

Unlike seed_atlas_corpus.py / seed_gfg_corpus.py / seed_hackerrank_corpus.py
(which write tier = NULL and never touch a curated link), this corpus is
curated from the start — each problem already comes tiered by rating band
(foundational/core/advanced) rather than auto-scraped, so re-seeding always
refreshes tier/position unconditionally, the same way seed_atlas.py's
problem_links loader treats atlas_problem_links.yaml.

Codeforces has no numeric external_id namespace shared with other platforms
(problems are identified by contestId+index, e.g. "427C"), so that combined
string is stored as external_slug instead.

Usage:
  seed_codeforces_corpus.py atlas_codeforces_problems.yaml
  seed_codeforces_corpus.py --validate-only atlas_codeforces_problems.yaml
"""
import argparse
import os
import sys
from pathlib import Path

import yaml


DIFFICULTIES = {"easy", "medium", "hard"}
TIERS = {"foundational", "core", "advanced"}


def require(mapping, key, where):
    value = mapping.get(key)
    if value in (None, ""):
        raise ValueError(f"{where}: missing {key}")
    return value


def load_corpus(path):
    data = yaml.safe_load(Path(path).read_text())
    if not isinstance(data, dict):
        raise ValueError(f"{path}: manifest must be a mapping")
    if data.get("platform") != "codeforces":
        raise ValueError(f"{path}: expected platform: codeforces")
    subpatterns = require(data, "subpatterns", "corpus manifest")

    seen_slugs = set()
    rows = []
    for entry in subpatterns:
        code = require(entry, "code", "corpus subpattern")
        problems = entry.get("problems") or []
        if not isinstance(problems, list):
            raise ValueError(f"corpus {code}: problems must be a list")
        for position, item in enumerate(problems, 1):
            slug = require(item, "external_slug", f"corpus {code}")
            if slug in seen_slugs:
                raise ValueError(f"problem {slug!r} mapped twice")
            seen_slugs.add(slug)
            difficulty = require(item, "difficulty", f"corpus {code} {slug}")
            if difficulty not in DIFFICULTIES:
                raise ValueError(f"corpus {code} {slug}: invalid difficulty {difficulty}")
            tier = require(item, "tier", f"corpus {code} {slug}")
            if tier not in TIERS:
                raise ValueError(f"corpus {code} {slug}: invalid tier {tier}")
            rows.append({
                "code": code,
                "slug": slug,
                "title": require(item, "title", f"corpus {code} {slug}"),
                "url": require(item, "url", f"corpus {code} {slug}"),
                "difficulty": difficulty,
                "tier": tier,
                "position": position,
            })
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
    subpattern_ids = resolve_subpatterns(cur, {r["code"] for r in rows})

    cur.execute("SELECT id FROM platforms WHERE code = 'codeforces'")
    platform = cur.fetchone()
    if not platform:
        raise ValueError("platform 'codeforces' is missing; run migrations first")
    platform_id = platform[0]

    inserted = 0
    linked = 0
    for row in rows:
        cur.execute(
            """
            INSERT INTO problems (
                platform_id, external_slug, title, url, difficulty, source_type
            ) VALUES (%s, %s, %s, %s, %s, 'dataset')
            ON CONFLICT (platform_id, external_slug) DO UPDATE SET
                title = EXCLUDED.title,
                difficulty = EXCLUDED.difficulty,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
            """,
            (platform_id, row["slug"], row["title"], row["url"], row["difficulty"]),
        )
        problem_id = cur.fetchone()[0]
        inserted += 1

        # Curated from the start (see module docstring) — unlike the plain
        # corpus seeders, always refresh tier/position on re-seed.
        cur.execute(
            """
            INSERT INTO problem_subpatterns (problem_id, subpattern_id, tier, position)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (problem_id, subpattern_id) DO UPDATE SET
                tier = EXCLUDED.tier,
                position = EXCLUDED.position
            """,
            (problem_id, subpattern_ids[row["code"]], row["tier"], row["position"]),
        )
        linked += cur.rowcount
    return inserted, linked


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("corpus", help="Codeforces corpus YAML")
    parser.add_argument("--validate-only", action="store_true", help="validate YAML without Postgres")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    rows = load_corpus(args.corpus)

    if args.validate_only:
        print(f"validated {len(rows)} corpus problems")
        return

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is required")

    import psycopg

    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                inserted, linked = upsert_corpus(cur, rows)

    print(f"seeded codeforces corpus: {len(rows)} problems ({inserted} upserted), {linked} links written")


if __name__ == "__main__":
    main()
