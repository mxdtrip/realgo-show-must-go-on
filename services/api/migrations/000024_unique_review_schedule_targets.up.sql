BEGIN;

DELETE FROM review_schedules rs
USING review_schedules newer
WHERE rs.id > newer.id
  AND rs.user_id = newer.user_id
  AND (
    (rs.problem_id IS NOT DISTINCT FROM newer.problem_id AND rs.problem_id IS NOT NULL)
    OR (rs.pattern_id IS NOT DISTINCT FROM newer.pattern_id AND rs.pattern_id IS NOT NULL)
    OR (rs.card_id IS NOT DISTINCT FROM newer.card_id AND rs.card_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS review_schedules_user_problem_unique
  ON review_schedules (user_id, problem_id)
  WHERE problem_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS review_schedules_user_pattern_unique
  ON review_schedules (user_id, pattern_id)
  WHERE pattern_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS review_schedules_user_card_unique
  ON review_schedules (user_id, card_id)
  WHERE card_id IS NOT NULL;

COMMIT;
