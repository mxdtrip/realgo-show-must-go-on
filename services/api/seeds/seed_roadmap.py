#!/usr/bin/env python3
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


def load_manifest(path):
    data = yaml.safe_load(Path(path).read_text())
    if not isinstance(data, dict):
        raise ValueError("manifest must be a mapping")

    code = require(data, "code", "manifest")
    title = require(data, "title", "manifest")
    sections = require(data, "sections", "manifest")
    if not isinstance(sections, list) or not sections:
        raise ValueError("manifest.sections must be a non-empty list")

    seen = set()
    position = 0
    rows = []
    for section_i, section in enumerate(sections, 1):
        pattern = require(section, "pattern", f"section {section_i}")
        pattern_code = require(pattern, "code", f"section {section_i}.pattern")
        pattern_name = require(pattern, "name", f"section {section_i}.pattern")
        problems = require(section, "problems", f"section {section_i}")
        if not isinstance(problems, list) or not problems:
            raise ValueError(f"section {section_i}.problems must be a non-empty list")

        for problem_i, problem in enumerate(problems, 1):
            slug = require(problem, "slug", f"section {section_i}.problem {problem_i}")
            if slug in seen:
                raise ValueError(f"duplicate problem slug: {slug}")
            seen.add(slug)

            difficulty = require(problem, "difficulty", f"problem {slug}").lower()
            if difficulty not in DIFFICULTIES:
                raise ValueError(f"problem {slug}: invalid difficulty {difficulty}")

            position += 1
            rows.append({
                "position": position,
                "pattern_code": pattern_code,
                "pattern_name": pattern_name,
                "external_id": str(require(problem, "external_id", f"problem {slug}")),
                "slug": slug,
                "title": require(problem, "title", f"problem {slug}"),
                "difficulty": difficulty,
                "url": require(problem, "url", f"problem {slug}"),
            })

    return code, title, rows


def upsert(cur, manifest_code, rows):
    cur.execute("SELECT id FROM platforms WHERE code = 'neetcode'")
    platform = cur.fetchone()
    if not platform:
        raise ValueError("platform 'neetcode' is missing; run migrations first")
    platform_id = platform[0]

    pattern_ids = {}
    for row in rows:
        code = row["pattern_code"]
        if code in pattern_ids:
            continue
        # Taxonomy nodes (patterns.taxonomy_version set by migration 000011)
        # keep their curated names; only legacy roadmap groupings follow the
        # manifest. The CASE keeps the upsert a real UPDATE so RETURNING
        # always yields the id.
        cur.execute(
            """
            INSERT INTO patterns (code, name)
            VALUES (%s, %s)
            ON CONFLICT (code) DO UPDATE SET name = CASE
                WHEN patterns.taxonomy_version IS NULL THEN EXCLUDED.name
                ELSE patterns.name
            END
            RETURNING id
            """,
            (code, row["pattern_name"]),
        )
        pattern_ids[code] = cur.fetchone()[0]

    problem_ids = {}
    for row in rows:
        cur.execute(
            """
            INSERT INTO problems (platform_id, external_id, external_slug, title, url, difficulty, source_type)
            VALUES (%s, %s, %s, %s, %s, %s, 'roadmap')
            ON CONFLICT (platform_id, external_slug) DO UPDATE SET
                external_id = EXCLUDED.external_id,
                title = EXCLUDED.title,
                url = EXCLUDED.url,
                difficulty = EXCLUDED.difficulty,
                source_type = EXCLUDED.source_type,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
            """,
            (
                platform_id,
                row["external_id"],
                row["slug"],
                row["title"],
                row["url"],
                row["difficulty"],
            ),
        )
        problem_ids[row["slug"]] = cur.fetchone()[0]

    cur.execute("DELETE FROM roadmap_items WHERE roadmap_code = %s", (manifest_code,))
    for row in rows:
        cur.execute(
            """
            INSERT INTO roadmap_items (roadmap_code, pattern_id, problem_id, position)
            VALUES (%s, %s, %s, %s)
            """,
            (
                manifest_code,
                pattern_ids[row["pattern_code"]],
                problem_ids[row["slug"]],
                row["position"],
            ),
        )


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: seed_roadmap.py <manifest.yaml>")

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is required")

    code, title, rows = load_manifest(sys.argv[1])
    import psycopg

    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                upsert(cur, code, rows)

    print(f"seeded {len(rows)} problems for {title} ({code})")


if __name__ == "__main__":
    main()
