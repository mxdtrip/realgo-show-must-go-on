#!/usr/bin/env python3
"""Seed Realgo Pattern Atlas data: learning materials, problem<->subpattern
links and (optionally, clearly demo-labelled) company relevance fixtures.

The taxonomy itself (13 tools / 22 families / 72 subpatterns) lives in
migration 000011 — this script only attaches content to existing nodes.

Usage:
  seed_atlas.py atlas_content.yaml atlas_problem_links.yaml [atlas_demo_companies.yaml]
  seed_atlas.py --validate-only <same args>
"""
import argparse
import json
import os
import sys
from pathlib import Path

import yaml


RELEVANCE_LEVELS = {"high", "medium", "low", "insufficient_evidence", "no_evidence"}
CONFIDENCE_LEVELS = {"high", "medium", "low"}
TIERS = {"foundational", "core", "advanced"}
MATERIAL_LIST_FIELDS = ("recognition_cues", "anti_cues", "common_mistakes")


def require(mapping, key, where):
    value = mapping.get(key)
    if value in (None, ""):
        raise ValueError(f"{where}: missing {key}")
    return value


def load_yaml(path):
    data = yaml.safe_load(Path(path).read_text())
    if not isinstance(data, dict):
        raise ValueError(f"{path}: manifest must be a mapping")
    return data


def load_materials(path):
    data = load_yaml(path)
    materials = require(data, "materials", "content manifest")
    seen = set()
    rows = []
    for index, item in enumerate(materials, 1):
        code = require(item, "code", f"material {index}")
        if code in seen:
            raise ValueError(f"duplicate material code: {code}")
        seen.add(code)
        what_it_is = require(item, "what_it_is", f"material {code}")
        lists = {}
        for key in MATERIAL_LIST_FIELDS:
            value = item.get(key) or []
            if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
                raise ValueError(f"material {code}: {key} must be a list of strings")
            lists[key] = value
        contrast = item.get("dont_confuse_with") or []
        if not isinstance(contrast, list):
            raise ValueError(f"material {code}: dont_confuse_with must be a list")
        pairs = []
        for pair in contrast:
            pairs.append({
                "title": require(pair, "title", f"material {code}.dont_confuse_with"),
                "note": require(pair, "note", f"material {code}.dont_confuse_with"),
            })
        rows.append({
            "code": code,
            "what_it_is": what_it_is,
            "mental_model": item.get("mental_model", ""),
            "core_invariant": item.get("core_invariant", ""),
            "canonical_skeleton": item.get("canonical_skeleton", ""),
            "mini_example": item.get("mini_example", ""),
            "dont_confuse_with": json.dumps(pairs, ensure_ascii=False),
            **lists,
        })
    return rows


def load_problem_links(path):
    data = load_yaml(path)
    links = require(data, "links", "links manifest")
    seen = set()
    rows = []
    for index, item in enumerate(links, 1):
        slug = require(item, "problem_slug", f"link {index}")
        subpatterns = require(item, "subpatterns", f"link {slug}")
        if not isinstance(subpatterns, list) or not subpatterns:
            raise ValueError(f"link {slug}: subpatterns must be a non-empty list")
        for position, sub in enumerate(subpatterns, 1):
            code = require(sub, "code", f"link {slug}.subpattern")
            tier = require(sub, "tier", f"link {slug}.{code}")
            if tier not in TIERS:
                raise ValueError(f"link {slug}.{code}: invalid tier {tier}")
            if (slug, code) in seen:
                raise ValueError(f"duplicate link: {slug} -> {code}")
            seen.add((slug, code))
            rows.append({"slug": slug, "code": code, "tier": tier, "position": position})
    return rows


def load_demo_companies(path):
    data = load_yaml(path)
    if data.get("source_type") != "demo":
        raise ValueError(f"{path}: company fixtures must declare source_type: demo")
    companies = require(data, "companies", "companies manifest")
    rows = []
    for company in companies:
        code = require(company, "code", "company")
        name = require(company, "name", f"company {code}")
        relevance = require(company, "relevance", f"company {code}")
        entries = []
        for item in relevance:
            level = require(item, "relevance", f"company {code}.relevance")
            confidence = require(item, "confidence", f"company {code}.relevance")
            if level not in RELEVANCE_LEVELS:
                raise ValueError(f"company {code}: invalid relevance {level}")
            if confidence not in CONFIDENCE_LEVELS:
                raise ValueError(f"company {code}: invalid confidence {confidence}")
            entries.append({
                "subpattern": require(item, "subpattern", f"company {code}.relevance"),
                "relevance": level,
                "confidence": confidence,
                "evidence_count": int(item.get("evidence_count", 0)),
                "last_seen": item.get("last_seen"),
            })
        problems = []
        for item in company.get("problems") or []:
            problems.append({
                "slug": require(item, "slug", f"company {code}.problems"),
                "evidence_count": int(item.get("evidence_count", 0)),
                "last_seen": item.get("last_seen"),
            })
        rows.append({"code": code, "name": name, "relevance": entries, "problems": problems})
    return rows


def resolve_ids(cur, table, key_column, keys, hint):
    if not keys:
        return {}
    cur.execute(f"SELECT {key_column}, id FROM {table} WHERE {key_column} = ANY(%s)", (list(keys),))
    found = dict(cur.fetchall())
    missing = sorted(set(keys) - set(found))
    if missing:
        raise ValueError(f"missing {table} rows ({hint}): " + ", ".join(str(m) for m in missing))
    return found


def upsert_materials(cur, rows):
    ids = resolve_ids(cur, "patterns", "code", {r["code"] for r in rows}, "run migrations first")
    for row in rows:
        cur.execute(
            """
            INSERT INTO pattern_learning_materials (
                pattern_id, what_it_is, mental_model, recognition_cues, anti_cues,
                core_invariant, canonical_skeleton, common_mistakes, dont_confuse_with,
                mini_example, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (pattern_id) DO UPDATE SET
                what_it_is = EXCLUDED.what_it_is,
                mental_model = EXCLUDED.mental_model,
                recognition_cues = EXCLUDED.recognition_cues,
                anti_cues = EXCLUDED.anti_cues,
                core_invariant = EXCLUDED.core_invariant,
                canonical_skeleton = EXCLUDED.canonical_skeleton,
                common_mistakes = EXCLUDED.common_mistakes,
                dont_confuse_with = EXCLUDED.dont_confuse_with,
                mini_example = EXCLUDED.mini_example,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                ids[row["code"]], row["what_it_is"], row["mental_model"],
                row["recognition_cues"], row["anti_cues"], row["core_invariant"],
                row["canonical_skeleton"], row["common_mistakes"], row["dont_confuse_with"],
                row["mini_example"],
            ),
        )


def upsert_problem_links(cur, rows):
    pattern_ids = resolve_ids(cur, "patterns", "code", {r["code"] for r in rows}, "run migrations first")
    slugs = sorted({r["slug"] for r in rows})
    cur.execute("SELECT external_slug, id FROM problems WHERE external_slug = ANY(%s)", (slugs,))
    problem_ids = dict(cur.fetchall())
    missing = sorted(set(slugs) - set(problem_ids))
    if missing:
        raise ValueError("missing problems (run seed_roadmap.py first): " + ", ".join(missing))

    for row in rows:
        cur.execute(
            """
            INSERT INTO problem_subpatterns (problem_id, subpattern_id, tier, position)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (problem_id, subpattern_id) DO UPDATE SET
                tier = EXCLUDED.tier,
                position = EXCLUDED.position
            """,
            (problem_ids[row["slug"]], pattern_ids[row["code"]], row["tier"], row["position"]),
        )


def upsert_demo_companies(cur, companies):
    sub_codes = {entry["subpattern"] for company in companies for entry in company["relevance"]}
    pattern_ids = resolve_ids(cur, "patterns", "code", sub_codes, "run migrations first")
    slugs = sorted({p["slug"] for company in companies for p in company["problems"]})
    problem_ids = {}
    if slugs:
        cur.execute("SELECT external_slug, id FROM problems WHERE external_slug = ANY(%s)", (slugs,))
        problem_ids = dict(cur.fetchall())
        missing = sorted(set(slugs) - set(problem_ids))
        if missing:
            raise ValueError("missing problems (run seed_roadmap.py first): " + ", ".join(missing))
    for company in companies:
        cur.execute(
            """
            INSERT INTO companies (code, name) VALUES (%s, %s)
            ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            (company["code"], company["name"]),
        )
        company_id = cur.fetchone()[0]
        # Refresh only demo rows: rows from real datasets must never be
        # touched by demo fixtures.
        cur.execute(
            "DELETE FROM subpattern_companies WHERE company_id = %s AND source_type = 'demo'",
            (company_id,),
        )
        for entry in company["relevance"]:
            cur.execute(
                """
                INSERT INTO subpattern_companies (
                    subpattern_id, company_id, relevance, confidence,
                    evidence_count, last_seen_at, source_type
                ) VALUES (%s, %s, %s, %s, %s, %s, 'demo')
                ON CONFLICT (subpattern_id, company_id) DO NOTHING
                """,
                (
                    pattern_ids[entry["subpattern"]], company_id, entry["relevance"],
                    entry["confidence"], entry["evidence_count"], entry["last_seen"],
                ),
            )
        cur.execute(
            "DELETE FROM company_problems WHERE company_id = %s AND source_type = 'demo'",
            (company_id,),
        )
        for problem in company["problems"]:
            cur.execute(
                """
                INSERT INTO company_problems (company_id, problem_id, evidence_count, last_seen_at, source_type)
                VALUES (%s, %s, %s, %s, 'demo')
                ON CONFLICT (company_id, problem_id) DO NOTHING
                """,
                (company_id, problem_ids[problem["slug"]], problem["evidence_count"], problem["last_seen"]),
            )


def parse_args(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("content", help="learning materials YAML")
    parser.add_argument("links", help="problem<->subpattern links YAML")
    parser.add_argument("demo_companies", nargs="?", help="demo company fixtures YAML (optional)")
    parser.add_argument("--validate-only", action="store_true", help="validate YAML without Postgres")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    materials = load_materials(args.content)
    links = load_problem_links(args.links)
    companies = load_demo_companies(args.demo_companies) if args.demo_companies else []

    if args.validate_only:
        print(f"validated {len(materials)} materials, {len(links)} problem links, "
              f"{len(companies)} demo companies")
        return

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is required")

    import psycopg

    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                upsert_materials(cur, materials)
                upsert_problem_links(cur, links)
                if companies:
                    upsert_demo_companies(cur, companies)

    print(f"seeded {len(materials)} materials, {len(links)} problem links, "
          f"{len(companies)} demo companies")


if __name__ == "__main__":
    main()
