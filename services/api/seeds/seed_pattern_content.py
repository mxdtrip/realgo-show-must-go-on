#!/usr/bin/env python3
import argparse
import os
import sys
from pathlib import Path

import yaml


LIST_FIELDS = ("techniques", "recognition_symptoms", "checklist")


def require(mapping, key, where):
    value = mapping.get(key)
    if value in (None, ""):
        raise ValueError(f"{where}: missing {key}")
    return value


def load_manifest(path):
    data = yaml.safe_load(Path(path).read_text())
    if not isinstance(data, dict):
        raise ValueError("pattern content manifest must be a mapping")

    code = require(data, "code", "manifest")
    title = require(data, "title", "manifest")
    patterns = require(data, "patterns", "manifest")
    if not isinstance(patterns, list) or not patterns:
        raise ValueError("manifest.patterns must be a non-empty list")

    seen = set()
    rows = []
    for index, pattern in enumerate(patterns, 1):
        if not isinstance(pattern, dict):
            raise ValueError(f"pattern {index}: must be a mapping")

        pattern_code = require(pattern, "code", f"pattern {index}")
        if pattern_code in seen:
            raise ValueError(f"duplicate pattern code: {pattern_code}")
        seen.add(pattern_code)

        description = require(pattern, "description", f"pattern {pattern_code}")
        if not isinstance(description, str):
            raise ValueError(f"pattern {pattern_code}: description must be a string")

        lists = {}
        for key in LIST_FIELDS:
            value = pattern.get(key) or []
            if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
                raise ValueError(f"pattern {pattern_code}: {key} must be a list of strings")
            lists[key] = value

        rows.append({
            "code": pattern_code,
            "description": description,
            "techniques": lists["techniques"],
            "recognition_symptoms": lists["recognition_symptoms"],
            "checklist": lists["checklist"],
        })

    return code, title, rows


def resolve_pattern_ids(cur, codes):
    if not codes:
        return {}
    cur.execute(
        "SELECT code, id FROM patterns WHERE code = ANY(%s)",
        (list(codes),),
    )
    found = dict(cur.fetchall())
    missing = sorted(set(codes) - set(found))
    if missing:
        raise ValueError(
            "missing patterns in database (run seed_roadmap.py first): "
            + ", ".join(missing)
        )
    return found


def upsert(cur, rows):
    pattern_ids = resolve_pattern_ids(cur, {row["code"] for row in rows})
    for row in rows:
        cur.execute(
            """
            UPDATE patterns
            SET description = %s,
                techniques = %s,
                recognition_symptoms = %s,
                checklist = %s
            WHERE id = %s
            """,
            (
                row["description"],
                row["techniques"],
                row["recognition_symptoms"],
                row["checklist"],
                pattern_ids[row["code"]],
            ),
        )


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Seed realgo pattern methodology content (description, techniques, "
        "recognition symptoms, checklist) into Postgres."
    )
    parser.add_argument("manifest", help="pattern content manifest YAML")
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="validate YAML without connecting to Postgres",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    code, title, rows = load_manifest(args.manifest)
    if args.validate_only:
        print(f"validated {len(rows)} patterns for {title} ({code})")
        return

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is required")

    import psycopg

    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                upsert(cur, rows)

    print(f"seeded content for {len(rows)} patterns ({code})")


if __name__ == "__main__":
    main()
