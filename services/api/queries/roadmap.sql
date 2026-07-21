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

-- name: ClearRoadmapTarget :exec
UPDATE users
SET target_company = NULL, interview_date = NULL, target_topics = '{}', updated_at = NOW()
WHERE id = $1;

-- name: GetUserRoadmapConfig :one
SELECT user_id, company_code, priority_mode, horizon_weeks, weekly_capacity,
       algorithm_version, source, generated_at
FROM user_roadmap_configs
WHERE user_id = $1;

-- name: ListUserRoadmapPlanItems :many
SELECT p.code, p.name, p.position AS taxonomy_position,
       i.week_index, i.position, i.selected
FROM user_roadmap_plan_items i
JOIN patterns p ON p.id = i.subpattern_id
WHERE i.user_id = $1
ORDER BY i.position;

-- name: UpsertUserRoadmapConfig :exec
INSERT INTO user_roadmap_configs (
    user_id, company_code, priority_mode, horizon_weeks, weekly_capacity,
    algorithm_version, source, generated_at, updated_at
) VALUES (
    sqlc.arg(user_id), sqlc.narg(company_code), sqlc.arg(priority_mode),
    sqlc.arg(horizon_weeks), sqlc.arg(weekly_capacity),
    sqlc.arg(algorithm_version), sqlc.arg(source), NOW(), NOW()
)
ON CONFLICT (user_id) DO UPDATE SET
    company_code = EXCLUDED.company_code,
    priority_mode = EXCLUDED.priority_mode,
    horizon_weeks = EXCLUDED.horizon_weeks,
    weekly_capacity = EXCLUDED.weekly_capacity,
    algorithm_version = EXCLUDED.algorithm_version,
    source = EXCLUDED.source,
    generated_at = NOW(),
    updated_at = NOW();

-- name: DeleteUserRoadmapPlanItems :exec
DELETE FROM user_roadmap_plan_items WHERE user_id = $1;

-- name: InsertUserRoadmapPlanItem :exec
INSERT INTO user_roadmap_plan_items (
    user_id, subpattern_id, week_index, position, selected
)
SELECT sqlc.arg(user_id), p.id, sqlc.arg(week_index), sqlc.arg(position), sqlc.arg(selected)
FROM patterns p
WHERE p.code = sqlc.arg(subpattern_code) AND p.kind = 'subpattern';

-- name: DeleteUserRoadmapConfig :exec
DELETE FROM user_roadmap_configs WHERE user_id = $1;

-- name: SetRoadmapTarget :exec
UPDATE users
SET target_company = NULLIF(sqlc.arg(target_company)::text, ''),
    interview_date = sqlc.narg(interview_date)::timestamptz,
    target_topics = sqlc.arg(target_topics)::text[],
    updated_at = NOW()
WHERE id = sqlc.arg(user_id);
