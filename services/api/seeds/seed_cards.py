#!/usr/bin/env python3
import argparse
import os
import re
import sys
from pathlib import Path

import yaml


CARD_TYPES = {"pattern_recognition", "algorithm_mechanics", "edge_case"}
TARGET_KEYS = ("problem_slug", "pattern_code")
KEY_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def require(mapping, key, where):
    value = mapping.get(key)
    if value in (None, ""):
        raise ValueError(f"{where}: missing {key}")
    return value


def sentence_count(value):
    return len([part for part in re.split(r"[.!?]+", value) if part.strip()])


def validate_text(card, key):
    value = require(card, key, f"card {card.get('key', '<unknown>')}")
    if not isinstance(value, str):
        raise ValueError(f"card {card['key']}: {key} must be a string")
    if "```" in value:
        raise ValueError(f"card {card['key']}: {key} must not contain code fences")
    return value


def load_roadmap_refs(path):
    data = yaml.safe_load(Path(path).read_text())
    if not isinstance(data, dict):
        raise ValueError("roadmap manifest must be a mapping")

    problem_slugs = set()
    pattern_codes = set()
    for section_i, section in enumerate(data.get("sections", []), 1):
        pattern = require(section, "pattern", f"roadmap section {section_i}")
        pattern_codes.add(require(pattern, "code", f"roadmap section {section_i}.pattern"))
        for problem_i, problem in enumerate(section.get("problems", []), 1):
            problem_slugs.add(
                require(problem, "slug", f"roadmap section {section_i}.problem {problem_i}")
            )
    return problem_slugs, pattern_codes


def load_manifest(path, roadmap_path=None):
    data = yaml.safe_load(Path(path).read_text())
    if not isinstance(data, dict):
        raise ValueError("cards manifest must be a mapping")

    code = require(data, "code", "manifest")
    title = require(data, "title", "manifest")
    cards = require(data, "cards", "manifest")
    if not isinstance(cards, list) or not cards:
        raise ValueError("manifest.cards must be a non-empty list")

    roadmap_refs = load_roadmap_refs(roadmap_path) if roadmap_path else None
    seen = set()
    rows = []
    for index, card in enumerate(cards, 1):
        if not isinstance(card, dict):
            raise ValueError(f"card {index}: must be a mapping")

        key = require(card, "key", f"card {index}")
        if not KEY_RE.match(key):
            raise ValueError(f"card {key}: invalid key")
        if key in seen:
            raise ValueError(f"duplicate card key: {key}")
        seen.add(key)

        card_type = require(card, "type", f"card {key}")
        if card_type not in CARD_TYPES:
            raise ValueError(f"card {key}: invalid type {card_type!r}")

        targets = [target for target in TARGET_KEYS if card.get(target)]
        if len(targets) != 1:
            raise ValueError(f"card {key}: exactly one of problem_slug or pattern_code is required")

        question = validate_text(card, "question")
        answer = validate_text(card, "answer")
        explanation = card.get("explanation")
        if explanation is not None and not isinstance(explanation, str):
            raise ValueError(f"card {key}: explanation must be a string")
        if explanation is not None and "```" in explanation:
            raise ValueError(f"card {key}: explanation must not contain code fences")
        if sentence_count(answer) > 4:
            raise ValueError(f"card {key}: answer must be 4 sentences or fewer")

        problem_slug = card.get("problem_slug")
        pattern_code = card.get("pattern_code")
        if roadmap_refs:
            problem_slugs, pattern_codes = roadmap_refs
            if problem_slug and problem_slug not in problem_slugs:
                raise ValueError(f"card {key}: unknown problem_slug {problem_slug!r}")
            if pattern_code and pattern_code not in pattern_codes:
                raise ValueError(f"card {key}: unknown pattern_code {pattern_code!r}")

        rows.append({
            "key": key,
            "type": card_type,
            "problem_slug": problem_slug,
            "pattern_code": pattern_code,
            "question": question,
            "answer": answer,
            "explanation": explanation,
            "source": f"{code}:{key}",
        })

    return code, title, rows


def table_constraints(cur, table):
    cur.execute(
        """
        SELECT c.conname, pg_get_constraintdef(c.oid)
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = %s
        """,
        (table,),
    )
    return dict(cur.fetchall())


def validate_cards_schema(cur, rows):
    constraints = table_constraints(cur, "cards")
    type_check = constraints.get("cards_type_check", "")
    missing_types = sorted({row["type"] for row in rows if row["type"] not in type_check})
    if missing_types:
        raise ValueError(
            "cards.cards_type_check does not allow manifest card types: "
            + ", ".join(missing_types)
        )

    target_check = constraints.get("card_type_target_check")
    if target_check and any(token in target_check for token in ("'problem'", "'pattern'", "'concept'")):
        # TODO(s10-seeds-content): remove this guard after the cards target
        # constraint is migrated from legacy type names to the contract card types.
        raise ValueError(
            "cards.card_type_target_check still references legacy type values "
            "('problem', 'pattern', 'concept'); cannot seed contract card types "
            "until that schema constraint is fixed outside seeds"
        )


def resolve_problem_ids(cur, slugs):
    if not slugs:
        return {}
    cur.execute(
        """
        SELECT p.external_slug, p.id
        FROM problems p
        JOIN platforms pl ON pl.id = p.platform_id
        WHERE pl.code = 'neetcode' AND p.external_slug = ANY(%s)
        """,
        (list(slugs),),
    )
    found = dict(cur.fetchall())
    missing = sorted(set(slugs) - set(found))
    if missing:
        raise ValueError("missing problems in database: " + ", ".join(missing))
    return found


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
        raise ValueError("missing patterns in database: " + ", ".join(missing))
    return found


def upsert(cur, manifest_code, rows):
    """Idempotent, non-destructive sync of seeded (global) cards.

    Seed jobs run on every deploy, and review_schedules/review_attempts
    reference cards with ON DELETE CASCADE. A DELETE + re-INSERT here would
    therefore wipe every user's review history on those cards and reshuffle
    card ids on each deploy. Instead we update rows in place by their stable
    `source` key and insert only what is new. Cards removed from a manifest
    are retained: without a tombstone/archive column, deleting them would
    cascade through schedules and attempts and destroy user history. Only
    global rows (user_id IS NULL) are ever touched, so user-created cards are
    safe even if their `source` collides with the manifest prefix.
    """
    validate_cards_schema(cur, rows)
    problem_ids = resolve_problem_ids(
        cur,
        {row["problem_slug"] for row in rows if row["problem_slug"]},
    )
    pattern_ids = resolve_pattern_ids(
        cur,
        {row["pattern_code"] for row in rows if row["pattern_code"]},
    )

    for row in rows:
        cur.execute(
            """
            UPDATE cards
            SET problem_id = %s, pattern_id = %s, type = %s, question = %s,
                answer = %s, explanation = %s, created_by_ai = false
            WHERE user_id IS NULL AND source = %s
            RETURNING id
            """,
            (
                problem_ids.get(row["problem_slug"]),
                pattern_ids.get(row["pattern_code"]),
                row["type"],
                row["question"],
                row["answer"],
                row["explanation"],
                row["source"],
            ),
        )
        if cur.fetchone() is not None:
            continue
        cur.execute(
            """
            INSERT INTO cards (
                user_id, problem_id, pattern_id, type, question, answer,
                explanation, source, created_by_ai
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, false)
            """,
            (
                None,
                problem_ids.get(row["problem_slug"]),
                pattern_ids.get(row["pattern_code"]),
                row["type"],
                row["question"],
                row["answer"],
                row["explanation"],
                row["source"],
            ),
        )


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Seed realgo card content into Postgres.")
    parser.add_argument("manifest", help="cards manifest YAML")
    parser.add_argument(
        "--roadmap",
        default="neetcode_150.yaml",
        help="roadmap manifest for local slug/code validation",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="validate YAML and roadmap references without connecting to Postgres",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    code, title, rows = load_manifest(args.manifest, args.roadmap)
    if args.validate_only:
        print(f"validated {len(rows)} cards for {title} ({code})")
        return

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is required")

    import psycopg

    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                upsert(cur, code, rows)

    print(f"seeded {len(rows)} cards for {title} ({code})")


if __name__ == "__main__":
    main()
