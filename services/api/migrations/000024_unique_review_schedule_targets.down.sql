BEGIN;

DROP INDEX IF EXISTS review_schedules_user_card_unique;
DROP INDEX IF EXISTS review_schedules_user_pattern_unique;
DROP INDEX IF EXISTS review_schedules_user_problem_unique;

COMMIT;
