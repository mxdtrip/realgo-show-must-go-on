#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

MIGRATE_IMAGE="${MIGRATE_IMAGE:-migrate/migrate:v4.18.1}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"

migrate() {
	docker run --rm --network host \
		-v "$PWD/migrations:/migrations:ro" \
		"$MIGRATE_IMAGE" \
		-path=/migrations \
		-database="$DATABASE_URL" \
		"$@"
}

psql_exec() {
	docker run --rm --network host \
		"$POSTGRES_IMAGE" \
		psql "$DATABASE_URL" -v ON_ERROR_STOP=1 "$@"
}

migrate up
migrate down -all

if [ -f migrations/000012_harden_data_constraints.up.sql ]; then
	migrate up 11
	psql_exec -c "INSERT INTO users (email, password_hash) VALUES ('legacy@example.test', 'hash');"
	psql_exec -c "INSERT INTO problems (external_slug, title, url) VALUES ('legacy-null-platform', 'Legacy Null Platform', 'https://example.test/problem');"
	psql_exec -c "INSERT INTO review_schedules (user_id, problem_id, pattern_id, next_review_at, interval_days, ease, stability, difficulty) VALUES (1, 1, 1, now(), 1, 2.5, 1, 1);"
	psql_exec -c "INSERT INTO review_attempts (user_id, problem_id, pattern_id, rating) VALUES (1, 1, 1, 3);"
	psql_exec -c "INSERT INTO cards (question, answer) VALUES ('legacy question', 'legacy answer');"
	psql_exec -c "INSERT INTO quiz_questions (question, options, correct_option) VALUES ('legacy quiz', '[]'::jsonb, 0);"
	migrate up 1
	migrate down -all
fi
