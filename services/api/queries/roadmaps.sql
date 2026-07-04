-- name: ListRoadmapItems :many
SELECT
    ri.position,
    pt.code AS pattern_code,
    pt.name AS pattern_name,
    p.id AS problem_id,
    p.external_id,
    p.external_slug,
    p.title,
    p.url,
    p.difficulty
FROM roadmap_items ri
JOIN patterns pt ON pt.id = ri.pattern_id
JOIN problems p ON p.id = ri.problem_id
WHERE ri.roadmap_code = $1
ORDER BY ri.position ASC;
