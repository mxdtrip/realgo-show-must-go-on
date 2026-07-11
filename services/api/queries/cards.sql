-- name: CreateCard :one
INSERT INTO cards (user_id, problem_id, pattern_id, type, question, answer, explanation, source, created_by_ai)
VALUES (
    sqlc.arg(user_id)::bigint,
    sqlc.narg(problem_id),
    sqlc.narg(pattern_id),
    sqlc.arg(card_type),
    sqlc.arg(question),
    sqlc.arg(answer),
    sqlc.narg(explanation),
    sqlc.narg(source),
    sqlc.arg(created_by_ai)
)
RETURNING *;

-- name: GetCardByID :one
SELECT c.id, c.user_id, c.problem_id, c.pattern_id, c.type, c.question, c.answer,
       c.explanation, c.source, c.created_by_ai, c.created_at,
       p.title AS problem_title, p.url AS problem_url, pat.name AS pattern_name
FROM cards c
LEFT JOIN problems p   ON p.id   = c.problem_id
LEFT JOIN patterns pat ON pat.id = c.pattern_id
WHERE c.id = sqlc.arg(card_id)::bigint AND c.user_id = sqlc.arg(user_id)::bigint;

-- name: UpdateCard :one
UPDATE cards
SET
    type        = COALESCE(sqlc.narg(card_type), type),
    question    = COALESCE(sqlc.narg(question), question),
    answer      = COALESCE(sqlc.narg(answer), answer),
    explanation = COALESCE(sqlc.narg(explanation), explanation),
    source      = COALESCE(sqlc.narg(source), source)
WHERE id = sqlc.arg(card_id)::bigint AND user_id = sqlc.arg(user_id)::bigint
RETURNING *;

-- name: DeleteCard :execrows
DELETE FROM cards
WHERE id = sqlc.arg(card_id)::bigint AND user_id = sqlc.arg(user_id)::bigint;

-- name: ListUserCards :many
SELECT
    c.id,
    c.type,
    c.question,
    c.answer,
    c.created_by_ai,
    c.created_at,
    CASE
        WHEN c.problem_id IS NOT NULL THEN 'problem'
        WHEN c.pattern_id IS NOT NULL THEN 'pattern'
        ELSE 'custom'
    END::text AS source_entity_type,
    COALESCE(c.problem_id, c.pattern_id) AS source_entity_id,
    COALESCE(
        NULLIF(concat_ws(' · ', NULLIF(p.title, ''), NULLIF(COALESCE(cpt.name, rpt.name), '')), ''),
        NULLIF(cpt.name, ''),
        NULLIF(c.source, ''),
        'custom card'
    )::text AS source_label,
    COALESCE(rs.id, 0)::bigint AS schedule_id,
    rs.next_review_at,
    rs.last_rating,
    COALESCE(rs.review_count, 0)::integer AS review_count,
    COALESCE(rs.state, 0)::integer AS review_state
FROM cards c
LEFT JOIN LATERAL (
    SELECT id, next_review_at, last_rating, review_count, state
    FROM review_schedules
    WHERE user_id = sqlc.arg(user_id)::bigint AND card_id = c.id
    ORDER BY next_review_at ASC, id ASC
    LIMIT 1
) rs ON true
LEFT JOIN problems p ON p.id = c.problem_id
LEFT JOIN patterns cpt ON cpt.id = c.pattern_id
LEFT JOIN roadmap_items ri ON ri.problem_id = c.problem_id AND ri.roadmap_code = 'neetcode_150'
LEFT JOIN patterns rpt ON rpt.id = ri.pattern_id
WHERE (
    c.user_id = sqlc.arg(user_id)::bigint
    OR (
        c.user_id IS NULL
        AND (
            c.created_by_ai IS NOT TRUE
            OR c.problem_id IS NULL
            OR EXISTS (
                SELECT 1 FROM user_problem_progress upp
                WHERE upp.user_id = sqlc.arg(user_id)::bigint
                  AND upp.problem_id = c.problem_id
                  AND upp.status IN ('solved', 'reviewing')
            )
        )
    )
    OR rs.id IS NOT NULL
  )
  AND (sqlc.arg(card_type)::text = '' OR c.type = sqlc.arg(card_type)::text)
  AND (
    sqlc.arg(pattern_code)::text = ''
    OR cpt.code = sqlc.arg(pattern_code)::text
    OR rpt.code = sqlc.arg(pattern_code)::text
  )
  AND (c.created_at, c.id) < (sqlc.arg(cursor_created_at)::timestamptz, sqlc.arg(cursor_id)::bigint)
ORDER BY c.created_at DESC, c.id DESC
LIMIT sqlc.arg(limit_rows)::integer;

-- name: ListCardsByProblem :many
-- Cards visible to the user for one problem: their own cards plus global
-- seed/AI cards (user_id IS NULL). Used by GET /me/problems/{id}/cards.
SELECT
    c.id,
    c.type,
    c.question,
    c.answer,
    c.created_by_ai,
    c.created_at,
    'problem'::text AS source_entity_type,
    c.problem_id AS source_entity_id,
    COALESCE(NULLIF(p.title, ''), 'custom card')::text AS source_label,
    COALESCE(rs.id, 0)::bigint AS schedule_id,
    rs.next_review_at,
    rs.last_rating,
    COALESCE(rs.review_count, 0)::integer AS review_count,
    COALESCE(rs.state, 0)::integer AS review_state
FROM cards c
LEFT JOIN LATERAL (
    SELECT id, next_review_at, last_rating, review_count, state
    FROM review_schedules
    WHERE user_id = sqlc.arg(user_id)::bigint AND card_id = c.id
    ORDER BY next_review_at ASC, id ASC
    LIMIT 1
) rs ON true
LEFT JOIN problems p ON p.id = c.problem_id
WHERE c.problem_id = sqlc.arg(problem_id)::bigint
  AND (c.user_id = sqlc.arg(user_id)::bigint OR c.user_id IS NULL)
ORDER BY c.created_at ASC, c.id ASC;

-- name: ListCardSession :many
SELECT
    c.id,
    c.type,
    c.question,
    c.answer,
    c.created_by_ai,
    c.created_at,
    CASE
        WHEN c.problem_id IS NOT NULL THEN 'problem'
        WHEN c.pattern_id IS NOT NULL THEN 'pattern'
        ELSE 'custom'
    END::text AS source_entity_type,
    COALESCE(c.problem_id, c.pattern_id) AS source_entity_id,
    COALESCE(
        NULLIF(concat_ws(' · ', NULLIF(p.title, ''), NULLIF(COALESCE(cpt.name, rpt.name), '')), ''),
        NULLIF(cpt.name, ''),
        NULLIF(c.source, ''),
        'custom card'
    )::text AS source_label,
    COALESCE(rs.id, 0)::bigint AS schedule_id,
    rs.next_review_at,
    rs.last_rating,
    COALESCE(rs.review_count, 0)::integer AS review_count,
    COALESCE(rs.state, 0)::integer AS review_state
FROM cards c
LEFT JOIN LATERAL (
    SELECT id, next_review_at, last_rating, review_count, state
    FROM review_schedules
    WHERE user_id = sqlc.arg(user_id)::bigint AND card_id = c.id
    ORDER BY next_review_at ASC, id ASC
    LIMIT 1
) rs ON true
LEFT JOIN problems p ON p.id = c.problem_id
LEFT JOIN patterns cpt ON cpt.id = c.pattern_id
LEFT JOIN roadmap_items ri ON ri.problem_id = c.problem_id AND ri.roadmap_code = 'neetcode_150'
LEFT JOIN patterns rpt ON rpt.id = ri.pattern_id
WHERE (
    c.user_id = sqlc.arg(user_id)::bigint
    OR (
        c.user_id IS NULL
        AND (
            c.created_by_ai IS NOT TRUE
            OR c.problem_id IS NULL
            OR EXISTS (
                SELECT 1 FROM user_problem_progress upp
                WHERE upp.user_id = sqlc.arg(user_id)::bigint
                  AND upp.problem_id = c.problem_id
                  AND upp.status IN ('solved', 'reviewing')
            )
        )
    )
    OR rs.id IS NOT NULL
  )
  AND (
    sqlc.arg(pattern_code)::text = ''
    OR cpt.code = sqlc.arg(pattern_code)::text
    OR rpt.code = sqlc.arg(pattern_code)::text
  )
  AND (
    (sqlc.arg(scope)::text = 'due' AND rs.next_review_at <= NOW())
    OR (sqlc.arg(scope)::text = 'hard_normal' AND rs.last_rating IN ('hard', 'normal'))
    OR (sqlc.arg(scope)::text = 'all')
    -- practice: карточки активных подпаттернов пользователя. Прегенерированный
    -- контент частично висит на family-узлах, поэтому подпаттерн в практике
    -- подтягивает и карточки своих семейств. ORDER BY ниже уже ставит
    -- просроченные вперёд, новые следом.
    OR (
      sqlc.arg(scope)::text = 'practice'
      AND (
        c.pattern_id IN (
          SELECT up.pattern_id FROM user_practice_patterns up
          WHERE up.user_id = sqlc.arg(user_id)::bigint
        )
        OR c.pattern_id IN (
          SELECT pfs.family_id
          FROM user_practice_patterns up
          JOIN pattern_family_subpatterns pfs ON pfs.subpattern_id = up.pattern_id
          WHERE up.user_id = sqlc.arg(user_id)::bigint
        )
      )
    )
  )
ORDER BY
    CASE
        WHEN rs.next_review_at <= NOW() THEN 0
        WHEN rs.id IS NULL THEN 1
        ELSE 2
    END,
    rs.next_review_at ASC NULLS LAST,
    c.created_at DESC,
    c.id DESC
LIMIT sqlc.arg(card_limit)::integer;

-- name: GetDueCardsSummary :many
-- Full (un-capped) due-today breakdown by type for the /cards launcher's
-- "Что повторяем сегодня" panel. Deliberately NOT reusing ListCardSession:
-- that query caps rows at session_limit (how many cards fit in one review
-- session), which would silently undercount "how many are due today" for
-- users with a large backlog. Visibility mirrors ListCardSession's due
-- branch exactly, simplified because a due row already requires an
-- existing review_schedules row owned by this user — the same condition
-- ListCardSession's `rs.id IS NOT NULL` visibility branch grants access on.
WITH due_cards AS (
    SELECT
        c.id,
        c.type,
        rs.next_review_at,
        COALESCE(
            NULLIF(concat_ws(' · ', NULLIF(p.title, ''), NULLIF(COALESCE(cpt.name, rpt.name), '')), ''),
            NULLIF(cpt.name, ''),
            NULLIF(c.source, ''),
            'custom card'
        )::text AS source_label
    FROM cards c
    JOIN LATERAL (
        SELECT next_review_at
        FROM review_schedules
        WHERE user_id = sqlc.arg(user_id)::bigint AND card_id = c.id
        ORDER BY next_review_at ASC, id ASC
        LIMIT 1
    ) rs ON true
    LEFT JOIN problems p ON p.id = c.problem_id
    LEFT JOIN patterns cpt ON cpt.id = c.pattern_id
    LEFT JOIN roadmap_items ri ON ri.problem_id = c.problem_id AND ri.roadmap_code = 'neetcode_150'
    LEFT JOIN patterns rpt ON rpt.id = ri.pattern_id
    WHERE rs.next_review_at <= NOW()
)
SELECT
    type,
    COUNT(*)::int AS count,
    (ARRAY_AGG(source_label ORDER BY next_review_at ASC))[1:3]::text[] AS sample_labels
FROM due_cards
GROUP BY type
ORDER BY type;

-- name: GetCardReviewSchedule :one
SELECT id
FROM review_schedules
WHERE user_id = $1 AND card_id = $2
ORDER BY id ASC
LIMIT 1;

-- name: GetAccessibleCard :one
SELECT c.id
FROM cards c
WHERE c.id = sqlc.arg(card_id)::bigint
  AND (
    c.user_id = sqlc.arg(user_id)::bigint
    OR (
        c.user_id IS NULL
        AND (
            c.created_by_ai IS NOT TRUE
            OR c.problem_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM user_problem_progress upp
                WHERE upp.user_id = sqlc.arg(user_id)::bigint
                  AND upp.problem_id = c.problem_id
                  AND upp.status IN ('solved', 'reviewing')
            )
        )
    )
    OR EXISTS (
        SELECT 1
        FROM review_schedules rs
        WHERE rs.user_id = sqlc.arg(user_id)::bigint AND rs.card_id = c.id
    )
  );

-- name: CreateCardReviewSchedule :one
INSERT INTO review_schedules (
    user_id, card_id, next_review_at, interval_days,
    ease, stability, difficulty, review_count, algorithm
)
VALUES ($1, $2, $3, 0, 2.5, 0.1, 5.0, 0, 'fsrs')
ON CONFLICT (user_id, card_id) WHERE card_id IS NOT NULL DO UPDATE
SET updated_at = review_schedules.updated_at
RETURNING id;

-- name: EnqueueCardsForPatternIfAbsent :exec
-- Eagerly seeds a review_schedules row (state=new, due now) for every global
-- card of a subpattern the moment it's added to practice, so the deck/due
-- lists reflect practice membership immediately instead of waiting for the
-- lazy schedule row CreateCardReviewSchedule only creates on first Rate().
INSERT INTO review_schedules (
    user_id, card_id, next_review_at, interval_days,
    ease, stability, difficulty, review_count, algorithm, state
)
SELECT sqlc.arg(user_id)::bigint, c.id, NOW(), 1, 2.5, 1.0, 5.0, 0, 'fsrs', 0
FROM cards c
WHERE c.pattern_id = sqlc.arg(pattern_id)::bigint AND c.user_id IS NULL
ON CONFLICT (user_id, card_id) WHERE card_id IS NOT NULL DO NOTHING;

-- name: CountCardSessionAttempts :one
SELECT COUNT(*)::integer
FROM review_attempts
WHERE user_id = $1
  AND card_id IS NOT NULL
  AND created_at >= $2;

-- name: HasReadyCards :one
-- Reports whether problemID already has global cards ready to serve without
-- new generation: seed content (created_by_ai = FALSE, curated, never stale)
-- or AI-generated cards at the current ai_prompt_version. An older-version
-- AI card doesn't count, so CardProvisioner regenerates instead of serving
-- stale content forever once the prompt bumps.
SELECT EXISTS (
    SELECT 1 FROM cards
    WHERE problem_id = sqlc.arg(problem_id)::bigint
      AND user_id IS NULL
      AND (
        created_by_ai IS NOT TRUE
        OR ai_prompt_version = sqlc.arg(ai_prompt_version)
      )
)::bool AS ready;

-- name: UpsertGeneratedCard :one
-- Idempotent insert for one AI-generated global card. Concurrent generations
-- for the same problem+type converge on cards_source_global_unique_idx via
-- the deterministic "ai:{platform}:{slug}:{type}" source key; ai_prompt_version
-- is refreshed on conflict so a prompt bump regenerates content in place
-- instead of leaving the invalidation check comparing against a stale value.
INSERT INTO cards (problem_id, type, question, answer, explanation, source, created_by_ai, ai_prompt_version)
VALUES (
    sqlc.arg(problem_id)::bigint,
    sqlc.arg(card_type),
    sqlc.arg(question),
    sqlc.arg(answer),
    sqlc.narg(explanation),
    sqlc.arg(source),
    TRUE,
    sqlc.arg(ai_prompt_version)
)
ON CONFLICT (source) WHERE user_id IS NULL AND source IS NOT NULL
DO UPDATE SET
    question          = EXCLUDED.question,
    answer            = EXCLUDED.answer,
    explanation       = EXCLUDED.explanation,
    ai_prompt_version = EXCLUDED.ai_prompt_version
RETURNING id;
