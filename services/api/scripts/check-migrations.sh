#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

MIGRATE_IMAGE="${MIGRATE_IMAGE:-migrate/migrate:v4.18.1}"

migrate() {
	docker run --rm --network host \
		-v "$PWD/migrations:/migrations:ro" \
		"$MIGRATE_IMAGE" \
		-path=/migrations \
		-database="$DATABASE_URL" \
		"$@"
}

migrate up
migrate down -all
