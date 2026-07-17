-- name: ListPatterns :many
-- All patterns with per-user progress counts for problems in neetcode_150.
SELECT
    pt.id,
    pt.code,
    pt.name,
    COALESCE(pt.description, '')::text AS description,
    pt.parent_id,
    COUNT(DISTINCT ri.problem_id)::integer AS problem_count,
    COUNT(DISTINCT upp.problem_id) FILTER (
        WHERE upp.status IN ('in_progress', 'solved', 'reviewing')
    )::integer AS solved_count,
    COUNT(DISTINCT rs.id) FILTER (
        WHERE rs.next_review_at <= NOW()
    )::integer AS due_count
FROM patterns pt
LEFT JOIN roadmap_items ri ON ri.pattern_id = pt.id AND ri.roadmap_code = 'neetcode_150'
LEFT JOIN user_problem_progress upp ON upp.problem_id = ri.problem_id AND upp.user_id = $1::bigint
LEFT JOIN review_schedules rs ON rs.pattern_id = pt.id AND rs.user_id = $1::bigint
GROUP BY pt.id, pt.code, pt.name, pt.description, pt.parent_id
ORDER BY pt.name ASC;

-- name: GetPatternByCode :one
SELECT
    id,
    code,
    name,
    description,
    techniques,
    recognition_symptoms,
    checklist
FROM patterns
WHERE code = $1;

-- name: ListPatternExampleProblems :many
SELECT
    p.id,
    p.title,
    p.difficulty,
    p.url
FROM roadmap_items ri
JOIN problems p ON p.id = ri.problem_id
WHERE ri.pattern_id = $1
  AND ri.roadmap_code = 'neetcode_150'
ORDER BY ri.position
LIMIT $2;

-- name: ListWeakPatterns :many
SELECT
    pt.code AS pattern_code,
    pt.name AS pattern_name,
    COUNT(*)::integer AS review_count,
    COUNT(*) FILTER (WHERE ra.rating = 'hard')::integer AS hard_count
FROM review_attempts ra
LEFT JOIN roadmap_items ri
    ON ri.problem_id = ra.problem_id AND ri.roadmap_code = 'neetcode_150'
LEFT JOIN cards c ON c.id = ra.card_id
LEFT JOIN roadmap_items card_ri
    ON card_ri.problem_id = c.problem_id AND card_ri.roadmap_code = 'neetcode_150'
JOIN patterns pt ON pt.id = COALESCE(ra.pattern_id, c.pattern_id, ri.pattern_id, card_ri.pattern_id)
WHERE ra.user_id = $1
GROUP BY pt.code, pt.name
HAVING COUNT(*) FILTER (WHERE ra.rating = 'hard') > 0
ORDER BY hard_count DESC, review_count DESC, pattern_name ASC
LIMIT $2;
