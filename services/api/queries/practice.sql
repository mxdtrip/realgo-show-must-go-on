-- Практика подпаттернов: личный набор «активных» подпаттернов пользователя.

-- name: ListPracticeSubpatterns :many
SELECT p.code, p.name, up.added_at
FROM user_practice_patterns up
JOIN patterns p ON p.id = up.pattern_id
WHERE up.user_id = sqlc.arg(user_id)::bigint
ORDER BY up.added_at DESC, p.name ASC;

-- name: GetSubpatternIDByCode :one
SELECT id FROM patterns
WHERE code = sqlc.arg(code)::text AND kind = 'subpattern';

-- name: AddPracticeSubpattern :exec
INSERT INTO user_practice_patterns (user_id, pattern_id)
VALUES (sqlc.arg(user_id)::bigint, sqlc.arg(pattern_id)::bigint)
ON CONFLICT (user_id, pattern_id) DO NOTHING;

-- name: RemovePracticeSubpattern :execrows
DELETE FROM user_practice_patterns
WHERE user_id = sqlc.arg(user_id)::bigint
  AND pattern_id = (
    SELECT id FROM patterns
    WHERE code = sqlc.arg(code)::text AND kind = 'subpattern'
  );

-- name: RemoveUnreviewedPracticeSchedules :execrows
-- Eager schedules created by Add are disposable until the user has actually
-- reviewed the card. Remove those untouched rows with the membership; keep
-- reviewed schedules/history intact.
DELETE FROM review_schedules rs
USING cards c, patterns p
WHERE rs.user_id = sqlc.arg(user_id)::bigint
  AND rs.card_id = c.id
  AND c.pattern_id = p.id
  AND p.code = sqlc.arg(code)::text
  AND p.kind = 'subpattern'
  AND COALESCE(rs.review_count, 0) = 0
  AND rs.last_review_at IS NULL;
