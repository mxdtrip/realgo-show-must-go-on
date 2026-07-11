#!/usr/bin/env python3
"""Seed the Realgo LeetCode corpus: dataset-imported problems and their
primary problem<->subpattern links.

The corpus is the coarse layer under the curated atlas_problem_links.yaml:
 - problems are deduplicated against existing rows by LeetCode external_id
   (NeetCode-150 roadmap rows keep their platform/title/source_type);
 - link upserts never touch curated rows (tier IS NOT NULL) — only
   corpus-created links (tier IS NULL) refresh their position.

Usage:
  seed_atlas_corpus.py atlas_corpus_problems.yaml
  seed_atlas_corpus.py --validate-only atlas_corpus_problems.yaml
"""
import argparse
import os
import sys
from pathlib import Path

import yaml


DIFFICULTIES = {"easy", "medium", "hard"}


def require(mapping, key, where):
    value = mapping.get(key)
    if value in (None, ""):
        raise ValueError(f"{where}: missing {key}")
    return value


def load_corpus(path):
    data = yaml.safe_load(Path(path).read_text())
    if not isinstance(data, dict):
        raise ValueError(f"{path}: manifest must be a mapping")
    subpatterns = require(data, "subpatterns", "corpus manifest")
    seen_ids = {}
    rows = []
    for entry in subpatterns:
        code = require(entry, "code", "corpus subpattern")
        problems = entry.get("problems") or []
        if not isinstance(problems, list):
            raise ValueError(f"corpus {code}: problems must be a list")
        for position, item in enumerate(problems, 1):
            external_id = require(item, "id", f"corpus {code}")
            if not isinstance(external_id, int):
                raise ValueError(f"corpus {code}: id must be an integer")
            if external_id in seen_ids:
                raise ValueError(
                    f"problem #{external_id} mapped twice: "
                    f"{seen_ids[external_id]} and {code}"
                )
            seen_ids[external_id] = code
            difficulty = require(item, "difficulty", f"corpus {code} #{external_id}")
            if difficulty not in DIFFICULTIES:
                raise ValueError(f"corpus {code} #{external_id}: invalid difficulty {difficulty}")
            rows.append({
                "code": code,
                "external_id": str(external_id),
                "slug": require(item, "slug", f"corpus {code} #{external_id}"),
                "title": require(item, "title", f"corpus {code} #{external_id}"),
                "difficulty": difficulty,
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

    cur.execute("SELECT id FROM platforms WHERE code = 'leetcode'")
    platform = cur.fetchone()
    if not platform:
        raise ValueError("platform 'leetcode' is missing; run migrations first")
    platform_id = platform[0]

    # Existing rows (any platform) by LeetCode number: NeetCode-150 problems
    # already carry external_id, so the corpus reuses them instead of creating
    # a second row for the same task.
    cur.execute(
        "SELECT external_id, MIN(id) FROM problems WHERE external_id = ANY(%s) GROUP BY external_id",
        (sorted({r["external_id"] for r in rows}),),
    )
    existing = dict(cur.fetchall())

    linked = 0
    inserted = 0
    for row in rows:
        problem_id = existing.get(row["external_id"])
        if problem_id is None:
            cur.execute(
                """
                INSERT INTO problems (
                    platform_id, external_id, external_slug, title, url,
                    difficulty, source_type
                ) VALUES (%s, %s, %s, %s, %s, %s, 'dataset')
                ON CONFLICT (platform_id, external_slug) DO UPDATE SET
                    external_id = EXCLUDED.external_id,
                    title = EXCLUDED.title,
                    difficulty = EXCLUDED.difficulty,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
                """,
                (
                    platform_id,
                    row["external_id"],
                    row["slug"],
                    row["title"],
                    f"https://leetcode.com/problems/{row['slug']}/",
                    row["difficulty"],
                ),
            )
            problem_id = cur.fetchone()[0]
            existing[row["external_id"]] = problem_id
            inserted += 1

        # Curated links (tier IS NOT NULL) stay authoritative; only
        # corpus-created links refresh their position on re-seed.
        cur.execute(
            """
            INSERT INTO problem_subpatterns (problem_id, subpattern_id, tier, position)
            VALUES (%s, %s, NULL, %s)
            ON CONFLICT (problem_id, subpattern_id) DO UPDATE SET
                position = EXCLUDED.position
            WHERE problem_subpatterns.tier IS NULL
            """,
            (problem_id, subpattern_ids[row["code"]], row["position"]),
        )
        linked += cur.rowcount
    return inserted, linked


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("corpus", help="corpus problems YAML")
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

    print(f"seeded corpus: {len(rows)} problems ({inserted} new), {linked} links written")


if __name__ == "__main__":
    main()
