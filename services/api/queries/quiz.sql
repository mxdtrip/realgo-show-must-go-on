-- name: ListQuizSession :many
-- Returns the user's quiz questions ordered by creation date (newest first).
-- Caller passes a limit for session size.
SELECT
    qq.id,
    qq.question,
    qq.options,
    qq.difficulty,
    qq.created_by_ai,
    qq.created_at,
    p.id    AS problem_id,
    p.title AS problem_title,
    pat.id   AS pattern_id,
    pat.name AS pattern_name
FROM quiz_questions qq
LEFT JOIN problems p   ON p.id   = qq.problem_id
LEFT JOIN patterns pat ON pat.id = qq.pattern_id
WHERE qq.user_id = sqlc.arg(user_id)::bigint
ORDER BY qq.created_at DESC
LIMIT sqlc.arg(session_limit)::int;

-- name: GetQuizQuestion :one
-- Returns a single question with the correct_option for answer verification.
SELECT
    qq.id,
    qq.question,
    qq.options,
    qq.correct_option,
    qq.explanation,
    qq.difficulty,
    qq.created_by_ai,
    qq.created_at,
    p.id    AS problem_id,
    p.title AS problem_title,
    pat.id   AS pattern_id,
    pat.name AS pattern_name
FROM quiz_questions qq
LEFT JOIN problems p   ON p.id   = qq.problem_id
LEFT JOIN patterns pat ON pat.id = qq.pattern_id
WHERE qq.id = sqlc.arg(question_id)::bigint AND qq.user_id = sqlc.arg(user_id)::bigint;
