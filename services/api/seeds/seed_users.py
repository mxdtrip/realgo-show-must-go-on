#!/usr/bin/env python3
import json
import os
from datetime import datetime

import bcrypt


# Local default only. On any publicly reachable deployment set
# SEED_USERS_PASSWORD to a secret value — these accounts (including the
# 'admin'-plan one) are recreated on every deploy, and the default password
# is documented in DEMO.md.
DEFAULT_PASSWORD = "Password123!"
CARD_SOURCE_CODE = "realgo_demo_cards"

USERS = [
    {
        "email": "tester@example.test",
        "timezone": "Europe/Moscow",
        "plan": "free",
        "interview_date": "2026-09-01T09:00:00+00:00",
        "progress": [
            ("contains-duplicate", "solved", "easy", 96, 6, "Arrays: warmed up"),
            ("valid-anagram", "solved", "normal", 82, 5, "Arrays: counting chars"),
            ("two-sum", "reviewing", "hard", 48, 4, "Arrays: due for complement review"),
            ("group-anagrams", "in_progress", None, 38, 3, "Arrays: grouping key draft"),
            ("top-k-frequent-elements", "not_started", None, 12, 2, "Arrays: next topic"),
            ("valid-palindrome", "solved", "easy", 88, 6, "Two pointers: baseline"),
            ("two-sum-ii-input-array-is-sorted", "reviewing", "normal", 62, 3, "Two pointers: sorted input"),
            ("3sum", "in_progress", None, 34, 2, "Two pointers: duplicates still tricky"),
            ("container-with-most-water", "skipped", None, 18, 1, "Two pointers: postponed"),
            ("best-time-to-buy-and-sell-stock", "solved", "easy", 92, 5, "Sliding window: one pass"),
            (
                "longest-substring-without-repeating-characters",
                "reviewing",
                "hard",
                42,
                1,
                "Sliding window: repeat boundary",
            ),
            ("longest-repeating-character-replacement", "in_progress", None, 36, 0, "Sliding window: window invariant"),
            ("valid-parentheses", "solved", "easy", 90, 4, "Stack: pair matching"),
            ("min-stack", "in_progress", None, 40, 0, "Stack: min history"),
            ("daily-temperatures", "reviewing", "normal", 66, 2, "Stack: monotonic review"),
            ("binary-search", "solved", "easy", 94, 3, "Binary search: bounds"),
            ("search-a-2d-matrix", "in_progress", None, 44, 0, "Binary search: matrix mapping"),
        ],
        "events": [
            ("leetcode", "problem_solved", "contains-duplicate", "easy", 150),
            ("leetcode", "problem_solved", "valid-anagram", "normal", 126),
            ("leetcode", "problem_viewed", "group-anagrams", None, 78),
            ("leetcode", "rating_changed", "two-sum", "hard", 54),
            ("leetcode", "problem_solved", "valid-palindrome", "easy", 32),
            ("leetcode", "problem_viewed", "longest-repeating-character-replacement", None, 8),
            ("leetcode", "problem_viewed", "min-stack", None, 2),
        ],
        "pattern_reviews": [
            ("arrays_hashing", "normal", -3, 2, 2.6, 3.5, 4.0, 2, 2),
            ("two_pointers", "easy", 18, 4, 2.8, 5.0, 3.2, 3, 2),
            ("sliding_window", "hard", -18, 1, 2.3, 2.2, 6.0, 2, 3),
            ("stack", "normal", -6, 2, 2.5, 3.1, 4.5, 2, 2),
            ("binary_search", "easy", 30, 5, 2.9, 6.0, 3.0, 4, 2),
        ],
        "card_reviews": [
            ("two-sum-complement", "hard", -1, 1, 2.3, 1.4, 6.0, 1, 1),
            ("valid-palindrome-two-pointers", "normal", 22, 3, 2.6, 3.0, 4.0, 2, 2),
        ],
    },
    {
        "email": "pro@example.test",
        "timezone": "UTC",
        "plan": "pro",
        "interview_date": "2026-10-15T12:00:00+00:00",
        "progress": [
            ("contains-duplicate", "solved", "normal", 80, 4, "Pro smoke data"),
            ("valid-palindrome", "reviewing", "easy", 70, 2, "Pro review item"),
            ("best-time-to-buy-and-sell-stock", "solved", "easy", 86, 1, "Pro sliding window"),
            ("binary-search", "in_progress", None, 45, 0, "Pro binary search"),
        ],
        "events": [
            ("leetcode", "problem_viewed", "valid-palindrome", None, 52),
            ("leetcode", "problem_solved", "valid-palindrome", "easy", 51),
            ("leetcode", "problem_viewed", "binary-search", None, 3),
        ],
    },
    {
        "email": "admin@example.test",
        "timezone": "Europe/Moscow",
        "plan": "admin",
        "interview_date": None,
        "progress": [],
        "events": [],
    },
]


def parse_time(value):
    if value is None:
        return None
    return datetime.fromisoformat(value)


def upsert_user(cur, user, password_hash):
    cur.execute(
        """
        INSERT INTO users (email, password_hash, timezone, plan, interview_date)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            timezone = EXCLUDED.timezone,
            plan = EXCLUDED.plan,
            interview_date = EXCLUDED.interview_date,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id
        """,
        (
            user["email"],
            password_hash,
            user["timezone"],
            user["plan"],
            parse_time(user["interview_date"]),
        ),
    )
    return cur.fetchone()[0]


def problem_ids(cur):
    cur.execute("SELECT external_slug, id FROM problems")
    return dict(cur.fetchall())


def problem_rows(cur):
    cur.execute("SELECT external_slug, title, url FROM problems")
    return {slug: {"title": title, "url": url} for slug, title, url in cur.fetchall()}


def pattern_ids(cur):
    cur.execute("SELECT code, id FROM patterns")
    return dict(cur.fetchall())


def seeded_card_ids(cur, source_code):
    source_prefix = f"{source_code}:"
    cur.execute(
        """
        SELECT source, id
        FROM cards
        WHERE LEFT(source, %s) = %s
        """,
        (len(source_prefix), source_prefix),
    )
    cards = {}
    for source, card_id in cur.fetchall():
        cards[source.split(":", 1)[1]] = card_id
    return cards


def platform_ids(cur):
    cur.execute("SELECT code, id FROM platforms")
    return dict(cur.fetchall())


def reset_seeded_demo_data(cur, user_ids):
    cur.execute("DELETE FROM extension_events WHERE user_id = ANY(%s)", (user_ids,))
    cur.execute("DELETE FROM review_attempts WHERE user_id = ANY(%s)", (user_ids,))
    cur.execute("DELETE FROM review_schedules WHERE user_id = ANY(%s)", (user_ids,))
    cur.execute("DELETE FROM user_problem_progress WHERE user_id = ANY(%s)", (user_ids,))


def table_columns(cur, table):
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table,),
    )
    return {row[0] for row in cur.fetchall()}


def seed_progress(cur, user_id, progress, problems, schedule_columns):
    for index, (slug, status, rating, confidence, age_days, note) in enumerate(progress):
        problem_id = problems.get(slug)
        if not problem_id:
            raise ValueError(f"problem {slug!r} is missing; run seed_roadmap.py first")

        done = status in ("solved", "reviewing")
        cur.execute(
            """
            INSERT INTO user_problem_progress (
                user_id, problem_id, status, rating, first_seen_at,
                solved_at, last_reviewed_at, confidence, note
            )
            VALUES (
                %s, %s, %s, %s,
                CURRENT_TIMESTAMP - (%s * INTERVAL '1 day'),
                CASE WHEN %s THEN CURRENT_TIMESTAMP - (%s * INTERVAL '1 day') END,
                CASE WHEN %s THEN CURRENT_TIMESTAMP - (%s * INTERVAL '1 day') END,
                %s, %s
            )
            ON CONFLICT (user_id, problem_id) DO UPDATE SET
                status = EXCLUDED.status,
                rating = EXCLUDED.rating,
                first_seen_at = EXCLUDED.first_seen_at,
                solved_at = EXCLUDED.solved_at,
                last_reviewed_at = EXCLUDED.last_reviewed_at,
                confidence = EXCLUDED.confidence,
                note = EXCLUDED.note
            """,
            (
                user_id,
                problem_id,
                status,
                rating,
                age_days,
                done,
                age_days,
                done,
                age_days,
                confidence,
                note,
            ),
        )

        if status in ("solved", "reviewing"):
            columns = [
                "user_id",
                "problem_id",
                "next_review_at",
                "interval_days",
                "ease",
                "stability",
                "difficulty",
                "review_count",
                "last_rating",
                "algorithm",
            ]
            values = [
                user_id,
                problem_id,
                index + 1,
                max(index + 1, 1),
                2.5,
                2.0 + index,
                3.0 + index,
                index + 1,
                rating or "normal",
                "seed",
            ]
            placeholders = [
                "%s",
                "%s",
                "CURRENT_TIMESTAMP - (%s * INTERVAL '1 hour')",
                "%s",
                "%s",
                "%s",
                "%s",
                "%s",
                "%s",
                "%s",
            ]
            if "state" in schedule_columns:
                columns.append("state")
                values.append(2 if status == "reviewing" else 1)
                placeholders.append("%s")
            if "last_review_at" in schedule_columns:
                columns.append("last_review_at")
                placeholders.append("CURRENT_TIMESTAMP - INTERVAL '1 day'")

            cur.execute(
                f"""
                INSERT INTO review_schedules ({", ".join(columns)})
                VALUES ({", ".join(placeholders)})
                """,
                values,
            )
            cur.execute(
                """
                INSERT INTO review_attempts (
                    user_id, problem_id, rating, review_type, duration_sec, was_correct, created_at
                )
                VALUES (
                    %s, %s, %s, 'problem', %s, %s,
                    CURRENT_TIMESTAMP - (%s * INTERVAL '1 day')
                )
                """,
                (
                    user_id,
                    problem_id,
                    rating or "normal",
                    180 + index * 30,
                    rating != "hard",
                    age_days,
                ),
            )


def insert_review_schedule(
    cur,
    user_id,
    target_column,
    target_id,
    rating,
    next_review_offset_hours,
    interval_days,
    ease,
    stability,
    difficulty,
    review_count,
    state,
    schedule_columns,
):
    columns = [
        "user_id",
        target_column,
        "next_review_at",
        "interval_days",
        "ease",
        "stability",
        "difficulty",
        "review_count",
        "last_rating",
        "algorithm",
    ]
    values = [
        user_id,
        target_id,
        next_review_offset_hours,
        interval_days,
        ease,
        stability,
        difficulty,
        review_count,
        rating,
        "seed",
    ]
    placeholders = [
        "%s",
        "%s",
        "CURRENT_TIMESTAMP + (%s * INTERVAL '1 hour')",
        "%s",
        "%s",
        "%s",
        "%s",
        "%s",
        "%s",
        "%s",
    ]
    if "state" in schedule_columns:
        columns.append("state")
        values.append(state)
        placeholders.append("%s")
    if "lapses" in schedule_columns:
        columns.append("lapses")
        values.append(1 if rating == "hard" else 0)
        placeholders.append("%s")
    if "last_review_at" in schedule_columns:
        columns.append("last_review_at")
        placeholders.append("CURRENT_TIMESTAMP - INTERVAL '1 day'")
    if "remaining_steps" in schedule_columns:
        columns.append("remaining_steps")
        values.append(1 if state in (1, 3) else 0)
        placeholders.append("%s")

    cur.execute(
        f"""
        INSERT INTO review_schedules ({", ".join(columns)})
        VALUES ({", ".join(placeholders)})
        """,
        values,
    )


def insert_review_attempt(
    cur,
    user_id,
    target_column,
    target_id,
    rating,
    review_type,
    duration_sec,
    was_correct,
    age_days,
):
    cur.execute(
        f"""
        INSERT INTO review_attempts (
            user_id, {target_column}, rating, review_type, duration_sec, was_correct, created_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP - (%s * INTERVAL '1 day'))
        """,
        (user_id, target_id, rating, review_type, duration_sec, was_correct, age_days),
    )


def seed_pattern_reviews(cur, user_id, reviews, patterns, schedule_columns):
    for index, (
        pattern_code,
        rating,
        next_review_offset_hours,
        interval_days,
        ease,
        stability,
        difficulty,
        review_count,
        state,
    ) in enumerate(reviews):
        pattern_id = patterns.get(pattern_code)
        if not pattern_id:
            raise ValueError(f"pattern {pattern_code!r} is missing; run seed_roadmap.py first")

        insert_review_schedule(
            cur,
            user_id,
            "pattern_id",
            pattern_id,
            rating,
            next_review_offset_hours,
            interval_days,
            ease,
            stability,
            difficulty,
            review_count,
            state,
            schedule_columns,
        )
        insert_review_attempt(
            cur,
            user_id,
            "pattern_id",
            pattern_id,
            rating,
            "pattern",
            150 + index * 20,
            rating != "hard",
            index % 7,
        )


def seed_card_reviews(cur, user_id, reviews, cards, schedule_columns, attempt_columns):
    if not reviews:
        return
    if "card_id" not in schedule_columns or "card_id" not in attempt_columns:
        print("warning: card_id columns are missing; skipping demo card review schedules")
        return
    if not cards:
        print(
            f"warning: no cards from {CARD_SOURCE_CODE!r}; "
            "run seed_cards.py before seed_users.py to add card review schedules"
        )
        return

    for index, (
        card_key,
        rating,
        next_review_offset_hours,
        interval_days,
        ease,
        stability,
        difficulty,
        review_count,
        state,
    ) in enumerate(reviews):
        card_id = cards.get(card_key)
        if not card_id:
            raise ValueError(f"card {card_key!r} is missing; run seed_cards.py first")

        insert_review_schedule(
            cur,
            user_id,
            "card_id",
            card_id,
            rating,
            next_review_offset_hours,
            interval_days,
            ease,
            stability,
            difficulty,
            review_count,
            state,
            schedule_columns,
        )
        insert_review_attempt(
            cur,
            user_id,
            "card_id",
            card_id,
            rating,
            "card",
            120 + index * 20,
            rating != "hard",
            index % 7,
        )


def seed_extension_events(cur, user_id, email, events, platforms, problems):
    for platform_code, event_type, slug, rating, age_hours in events:
        platform_id = platforms.get(platform_code)
        if not platform_id:
            raise ValueError(f"platform {platform_code!r} is missing; run migrations first")
        problem = problems.get(slug)
        if not problem:
            raise ValueError(f"problem {slug!r} is missing; run seed_roadmap.py first")

        payload = {
            "event": event_type,
            "source": platform_code,
            "rating": rating,
            "problem": {
                "externalId": slug,
                "title": problem["title"],
                "url": problem["url"],
            },
        }
        cur.execute(
            """
            INSERT INTO extension_events (
                user_id, platform_id, url, external_slug, title, event_type,
                rating, extension_version, event_time, idempotency_key, raw_payload
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, 'seed-demo',
                CURRENT_TIMESTAMP - (%s * INTERVAL '1 hour'), %s, %s::jsonb
            )
            """,
            (
                user_id,
                platform_id,
                problem["url"],
                slug,
                problem["title"],
                event_type,
                rating,
                age_hours,
                f"seed:{email}:{event_type}:{slug}:{age_hours}",
                json.dumps(payload),
            ),
        )


def main():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is required")

    password = os.environ.get("SEED_USERS_PASSWORD") or DEFAULT_PASSWORD
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    import psycopg

    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                users = [(upsert_user(cur, user, password_hash), user) for user in USERS]
                reset_seeded_demo_data(cur, [user_id for user_id, _ in users])
                problems = problem_ids(cur)
                patterns = pattern_ids(cur)
                cards = seeded_card_ids(cur, CARD_SOURCE_CODE)
                event_problems = problem_rows(cur)
                platforms = platform_ids(cur)
                schedule_columns = table_columns(cur, "review_schedules")
                attempt_columns = table_columns(cur, "review_attempts")
                for user_id, user in users:
                    seed_progress(cur, user_id, user["progress"], problems, schedule_columns)
                    seed_pattern_reviews(
                        cur,
                        user_id,
                        user.get("pattern_reviews", []),
                        patterns,
                        schedule_columns,
                    )
                    seed_card_reviews(
                        cur,
                        user_id,
                        user.get("card_reviews", []),
                        cards,
                        schedule_columns,
                        attempt_columns,
                    )
                    seed_extension_events(
                        cur, user_id, user["email"], user["events"], platforms, event_problems
                    )

    if password == DEFAULT_PASSWORD:
        print(f"seeded {len(USERS)} users with the default password {DEFAULT_PASSWORD!r}")
    else:
        # Never echo a secret supplied via SEED_USERS_PASSWORD into deploy logs.
        print(f"seeded {len(USERS)} users with the password from SEED_USERS_PASSWORD")


if __name__ == "__main__":
    main()
