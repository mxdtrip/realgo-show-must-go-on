#!/usr/bin/env python3
import os
from datetime import datetime, timezone

import bcrypt


PASSWORD = "Password123!"

USERS = [
    {
        "email": "tester@example.test",
        "timezone": "Europe/Moscow",
        "plan": "free",
        "interview_date": "2026-09-01T09:00:00+00:00",
        "progress": [
            ("contains-duplicate", "solved", "easy", 90, "Smoke: solved easy problem"),
            ("valid-anagram", "solved", "normal", 75, "Smoke: normal confidence"),
            ("two-sum", "reviewing", "hard", 45, "Smoke: due for review"),
            ("group-anagrams", "in_progress", None, 30, "Smoke: in progress"),
            ("top-k-frequent-elements", "not_started", None, 10, "Smoke: not started"),
        ],
    },
    {
        "email": "pro@example.test",
        "timezone": "UTC",
        "plan": "pro",
        "interview_date": "2026-10-15T12:00:00+00:00",
        "progress": [
            ("contains-duplicate", "solved", "normal", 80, "Pro smoke data"),
            ("valid-palindrome", "reviewing", "easy", 70, "Pro review item"),
        ],
    },
    {
        "email": "admin@example.test",
        "timezone": "Europe/Moscow",
        "plan": "admin",
        "interview_date": None,
        "progress": [],
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
    now = datetime.now(timezone.utc)
    for index, (slug, status, rating, confidence, note) in enumerate(progress):
        problem_id = problems.get(slug)
        if not problem_id:
            raise ValueError(f"problem {slug!r} is missing; run seed_roadmap.py first")

        solved_at = now if status in ("solved", "reviewing") else None
        cur.execute(
            """
            INSERT INTO user_problem_progress (
                user_id, problem_id, status, rating, first_seen_at,
                solved_at, last_reviewed_at, confidence, note
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                now,
                solved_at,
                solved_at,
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
                    user_id, problem_id, rating, review_type, duration_sec, was_correct
                )
                VALUES (%s, %s, %s, 'problem', %s, %s)
                """,
                (
                    user_id,
                    problem_id,
                    rating or "normal",
                    180 + index * 30,
                    rating != "hard",
                ),
            )


def main():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL is required")

    password_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()

    import psycopg

    with psycopg.connect(dsn) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                users = [(upsert_user(cur, user, password_hash), user) for user in USERS]
                reset_seeded_demo_data(cur, [user_id for user_id, _ in users])
                problems = problem_ids(cur)
                schedule_columns = table_columns(cur, "review_schedules")
                for user_id, user in users:
                    seed_progress(cur, user_id, user["progress"], problems, schedule_columns)

    print(f"seeded {len(USERS)} users with password {PASSWORD!r}")


if __name__ == "__main__":
    main()
