-- Assistant queries: problem context for extension-driven AI hints.

-- name: GetAssistantProblemContext :one
SELECT
    p.id,
    p.title,
    p.url,
    COALESCE(p.difficulty, 'unknown')::text AS difficulty,
    pl.code AS platform,
    p.external_slug AS slug
FROM problems p
JOIN platforms pl ON pl.id = p.platform_id
WHERE pl.code = sqlc.arg(platform)::text
  AND p.external_slug = sqlc.arg(slug)::text;

-- name: ListAssistantProblemSubpatterns :many
SELECT
    sp.code,
    sp.name,
    COALESCE(ps.tier, '')::text AS tier,
    COALESCE(sp.description, '')::text AS description,
    COALESCE(string_agg(DISTINCT f.name, ', ' ORDER BY f.name), '')::text AS families
FROM problem_subpatterns ps
JOIN patterns sp ON sp.id = ps.subpattern_id AND sp.kind = 'subpattern'
LEFT JOIN pattern_family_subpatterns pfs ON pfs.subpattern_id = sp.id
LEFT JOIN patterns f ON f.id = pfs.family_id AND f.kind = 'family'
WHERE ps.problem_id = sqlc.arg(problem_id)::bigint
GROUP BY sp.code, sp.name, ps.tier, sp.description, ps.position
ORDER BY
    CASE ps.tier
        WHEN 'foundational' THEN 0
        WHEN 'core' THEN 1
        WHEN 'advanced' THEN 2
        ELSE 3
    END,
    ps.position NULLS LAST,
    sp.name;

-- name: LogAssistantHintRequest :exec
INSERT INTO ai_request_logs (user_id, feature, provider, model, status)
VALUES (
    sqlc.arg(user_id)::bigint,
    'assistant_hint',
    'gemini',
    sqlc.arg(model)::text,
    sqlc.arg(status)::text
);
