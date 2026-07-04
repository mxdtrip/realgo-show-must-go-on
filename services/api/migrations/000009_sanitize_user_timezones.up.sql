BEGIN;

-- Reset any stored timezone Postgres cannot resolve back to UTC. Until now
-- PATCH /me/profile accepted arbitrary strings, and the dashboard metrics
-- query evaluates `AT TIME ZONE users.timezone`, so a single bad value made
-- GET /me/dashboard fail with a database error for that user on every request.
-- Matching is case-insensitive against both full zone names and abbreviations,
-- mirroring how AT TIME ZONE itself resolves its argument, so values that
-- currently work are left untouched.
UPDATE users
SET timezone = 'UTC'
WHERE timezone IS NOT NULL
  AND timezone <> ''
  AND lower(timezone) NOT IN (SELECT lower(name) FROM pg_timezone_names)
  AND lower(timezone) NOT IN (SELECT lower(abbrev) FROM pg_timezone_abbrevs);

COMMIT;
