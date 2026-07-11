-- name: GetRoadmapUserTarget :one
SELECT target_company, interview_date, target_topics
FROM users
WHERE id = $1;

-- name: ListUserRoadmapItems :many
SELECT
    ri.position,
    pt.code AS pattern_code,
    pt.name AS pattern_name,
    p.id AS problem_id,
    p.external_id,
    p.external_slug,
    p.title,
    p.url,
    p.difficulty,
    COALESCE(upp.status, 'not_started')::text AS status,
    upp.rating,
    upp.confidence
FROM roadmap_items ri
JOIN patterns pt ON pt.id = ri.pattern_id
JOIN problems p ON p.id = ri.problem_id
LEFT JOIN user_problem_progress upp
    ON upp.problem_id = p.id AND upp.user_id = $2
WHERE ri.roadmap_code = $1
ORDER BY ri.position ASC;
