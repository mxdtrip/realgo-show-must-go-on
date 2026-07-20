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
  AND NOT EXISTS (
    SELECT 1
    FROM quiz_answers qa
    WHERE qa.user_id = sqlc.arg(user_id)::bigint
      AND qa.question_id = qq.id
  )
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

-- name: RecordQuizAnswer :execrows
-- Фиксирует ответ пользователя. Анти-чит: UNIQUE (user_id, question_id) +
-- ON CONFLICT DO NOTHING делает вставку атомарной — количество затронутых
-- строк (1 = первый ответ записан, 0 = пара уже существует / повтор) заменяет
-- отдельную проверку IsAnswered и не имеет TOCTOU-окна.
INSERT INTO quiz_answers (user_id, question_id, selected_option, was_correct)
VALUES (sqlc.arg(user_id)::bigint, sqlc.arg(question_id)::bigint,
        sqlc.arg(selected_option)::int, sqlc.arg(was_correct)::bool)
ON CONFLICT (user_id, question_id) DO NOTHING;
