-- Pattern Atlas queries: Realgo Taxonomy nodes, many-to-many edges,
-- per-user subpattern stats and the company relevance overlay.
-- Each atlas page load is a fixed, small set of flat queries (no N+1).

-- name: ListTaxonomyNodes :many
SELECT
    id,
    code,
    name,
    kind,
    COALESCE(description, '')::text AS description,
    COALESCE(position, 0)::integer AS position
FROM patterns
WHERE taxonomy_version = $1
ORDER BY kind, position, code;

-- name: CountTaxonomyNodesByKind :many
SELECT kind, COUNT(*)::integer AS node_count
FROM patterns
WHERE taxonomy_version = $1
GROUP BY kind
ORDER BY kind;

-- name: ListFamilySubpatternEdges :many
SELECT
    f.code AS family_code,
    s.code AS subpattern_code,
    e.position
FROM pattern_family_subpatterns e
JOIN patterns f ON f.id = e.family_id
JOIN patterns s ON s.id = e.subpattern_id
ORDER BY f.position, e.position;

-- name: ListSubpatternPrerequisiteEdges :many
SELECT
    s.code AS subpattern_code,
    t.code AS tool_code
FROM subpattern_prerequisites sp
JOIN patterns s ON s.id = sp.subpattern_id
JOIN patterns t ON t.id = sp.tool_id
ORDER BY s.position, t.position;

-- name: GetAtlasNodeByCode :one
SELECT
    id,
    code,
    name,
    kind,
    COALESCE(description, '')::text AS description,
    taxonomy_version,
    techniques,
    recognition_symptoms,
    checklist
FROM patterns
WHERE code = $1;

-- Per-subpattern practice progress: linked problems, solved/in-progress
-- counts, due problem reviews.
-- name: ListUserSubpatternProblemStats :many
SELECT
    sp.code,
    COUNT(ps.problem_id)::integer AS problem_count,
    COUNT(*) FILTER (WHERE upp.status IN ('solved', 'reviewing'))::integer AS solved_count,
    COUNT(*) FILTER (WHERE upp.status = 'in_progress')::integer AS in_progress_count,
    COUNT(*) FILTER (WHERE rs.next_review_at <= NOW())::integer AS due_problem_count,
    MAX(upp.solved_at)::timestamptz AS last_solved_at
FROM patterns sp
JOIN problem_subpatterns ps ON ps.subpattern_id = sp.id
LEFT JOIN user_problem_progress upp
    ON upp.problem_id = ps.problem_id AND upp.user_id = $1::bigint
LEFT JOIN review_schedules rs
    ON rs.problem_id = ps.problem_id AND rs.user_id = $1::bigint
WHERE sp.kind = 'subpattern'
GROUP BY sp.code;

-- Review attempts mapped onto subpatterns through any of the three review
-- targets: the subpattern's problems, the subpattern node itself, or cards
-- attached to the subpattern node.
-- name: ListUserSubpatternAttemptStats :many
WITH mapped AS (
    SELECT ps.subpattern_id, ra.rating, ra.created_at
    FROM review_attempts ra
    JOIN problem_subpatterns ps ON ps.problem_id = ra.problem_id
    WHERE ra.user_id = $1::bigint
    UNION ALL
    SELECT p.id, ra.rating, ra.created_at
    FROM review_attempts ra
    JOIN patterns p ON p.id = ra.pattern_id AND p.kind = 'subpattern'
    WHERE ra.user_id = $1::bigint
    UNION ALL
    SELECT p.id, ra.rating, ra.created_at
    FROM review_attempts ra
    JOIN cards c ON c.id = ra.card_id AND c.pattern_id IS NOT NULL
    JOIN patterns p ON p.id = c.pattern_id AND p.kind = 'subpattern'
    WHERE ra.user_id = $1::bigint
)
SELECT
    p.code,
    COUNT(*)::integer AS attempt_count,
    COUNT(*) FILTER (WHERE m.rating = 'hard')::integer AS hard_count,
    MAX(m.created_at)::timestamptz AS last_attempt_at
FROM mapped m
JOIN patterns p ON p.id = m.subpattern_id
GROUP BY p.code;

-- Spaced-repetition state that targets the subpattern itself (node reviews
-- and cards attached to the node).
-- name: ListUserSubpatternReviewStats :many
WITH targets AS (
    SELECT p.id AS subpattern_id, rs.next_review_at
    FROM review_schedules rs
    JOIN patterns p ON p.id = rs.pattern_id AND p.kind = 'subpattern'
    WHERE rs.user_id = $1::bigint
    UNION ALL
    SELECT p.id, rs.next_review_at
    FROM review_schedules rs
    JOIN cards c ON c.id = rs.card_id AND c.pattern_id IS NOT NULL
    JOIN patterns p ON p.id = c.pattern_id AND p.kind = 'subpattern'
    WHERE rs.user_id = $1::bigint
)
SELECT
    p.code,
    COUNT(*) FILTER (WHERE t.next_review_at <= NOW())::integer AS due_count,
    MIN(t.next_review_at)::timestamptz AS next_review_at
FROM targets t
JOIN patterns p ON p.id = t.subpattern_id
GROUP BY p.code;

-- name: ListSubpatternCardCounts :many
SELECT
    p.code,
    COUNT(*)::integer AS card_count
FROM cards c
JOIN patterns p ON p.id = c.pattern_id AND p.kind = 'subpattern'
WHERE c.user_id IS NULL OR c.user_id = $1::bigint
GROUP BY p.code;

-- name: ListAtlasCompanies :many
SELECT
    co.code,
    co.name,
    COUNT(sc.subpattern_id)::integer AS subpattern_count,
    BOOL_AND(sc.source_type = 'demo')::boolean AS demo_only,
    MAX(sc.last_seen_at)::date AS last_seen_at
FROM companies co
JOIN subpattern_companies sc ON sc.company_id = co.id
GROUP BY co.id, co.code, co.name
ORDER BY co.name;

-- name: ListCompanySubpatternRelevance :many
SELECT
    p.code,
    sc.relevance,
    sc.confidence,
    sc.evidence_count,
    sc.last_seen_at,
    sc.source_type
FROM subpattern_companies sc
JOIN companies co ON co.id = sc.company_id
JOIN patterns p ON p.id = sc.subpattern_id
WHERE co.code = $1;

-- name: ListSubpatternRelevantCompanies :many
SELECT
    co.code,
    co.name,
    sc.relevance,
    sc.confidence,
    sc.evidence_count,
    sc.last_seen_at,
    sc.source_type
FROM subpattern_companies sc
JOIN companies co ON co.id = sc.company_id
WHERE sc.subpattern_id = $1
ORDER BY
    CASE sc.relevance
        WHEN 'high' THEN 0
        WHEN 'medium' THEN 1
        WHEN 'low' THEN 2
        WHEN 'insufficient_evidence' THEN 3
        ELSE 4
    END,
    co.name;

-- name: GetPatternLearningMaterial :one
SELECT
    pattern_id,
    what_it_is,
    mental_model,
    recognition_cues,
    anti_cues,
    core_invariant,
    canonical_skeleton,
    common_mistakes,
    dont_confuse_with,
    mini_example
FROM pattern_learning_materials
WHERE pattern_id = $1;

-- name: ListSubpatternFamilies :many
SELECT f.code, f.name
FROM pattern_family_subpatterns e
JOIN patterns f ON f.id = e.family_id
WHERE e.subpattern_id = $1
ORDER BY f.position;

-- name: ListSubpatternTools :many
SELECT t.code, t.name
FROM subpattern_prerequisites sp
JOIN patterns t ON t.id = sp.tool_id
WHERE sp.subpattern_id = $1
ORDER BY t.position;

-- General practice set of a subpattern with the user's state.
-- name: ListSubpatternPracticeProblems :many
SELECT
    pr.id,
    pr.title,
    pr.url,
    COALESCE(pr.difficulty, '')::text AS difficulty,
    COALESCE(ps.tier, '')::text AS tier,
    COALESCE(upp.status, 'not_started')::text AS status,
    upp.rating,
    upp.solved_at,
    rs.next_review_at
FROM problem_subpatterns ps
JOIN problems pr ON pr.id = ps.problem_id
LEFT JOIN user_problem_progress upp
    ON upp.problem_id = pr.id AND upp.user_id = sqlc.arg(user_id)::bigint
LEFT JOIN review_schedules rs
    ON rs.problem_id = pr.id AND rs.user_id = sqlc.arg(user_id)::bigint
WHERE ps.subpattern_id = sqlc.arg(subpattern_id)::bigint
ORDER BY
    CASE ps.tier
        WHEN 'foundational' THEN 0
        WHEN 'core' THEN 1
        WHEN 'advanced' THEN 2
        ELSE 3
    END,
    ps.position NULLS LAST,
    pr.title;

-- Company-specific practice: problems of this subpattern that carry
-- evidence records for a company.
-- name: ListSubpatternCompanyProblems :many
SELECT
    co.code AS company_code,
    co.name AS company_name,
    pr.id,
    pr.title,
    pr.url,
    COALESCE(pr.difficulty, '')::text AS difficulty,
    cp.evidence_count,
    cp.last_seen_at,
    cp.source_type,
    COALESCE(upp.status, 'not_started')::text AS status,
    rs.next_review_at
FROM problem_subpatterns ps
JOIN company_problems cp ON cp.problem_id = ps.problem_id
JOIN companies co ON co.id = cp.company_id
JOIN problems pr ON pr.id = ps.problem_id
LEFT JOIN user_problem_progress upp
    ON upp.problem_id = pr.id AND upp.user_id = sqlc.arg(user_id)::bigint
LEFT JOIN review_schedules rs
    ON rs.problem_id = pr.id AND rs.user_id = sqlc.arg(user_id)::bigint
WHERE ps.subpattern_id = sqlc.arg(subpattern_id)::bigint
ORDER BY co.name, pr.title;

-- Company-scoped practice: every problem with evidence for a company,
-- joined to the subpatterns it practices. Drives the readiness overlay so
-- relevant tasks can surface next to relevant subpatterns. A problem that
-- practices several subpatterns repeats once per link.
-- name: ListCompanyRelevantProblems :many
SELECT
    p.code AS subpattern_code,
    p.name AS subpattern_name,
    COALESCE(ps.tier, '')::text AS tier,
    pr.id,
    pr.title,
    pr.url,
    COALESCE(pr.difficulty, '')::text AS difficulty,
    cp.evidence_count,
    cp.last_seen_at,
    cp.source_type,
    COALESCE(upp.status, 'not_started')::text AS status,
    rs.next_review_at
FROM company_problems cp
JOIN companies co ON co.id = cp.company_id
JOIN problems pr ON pr.id = cp.problem_id
JOIN problem_subpatterns ps ON ps.problem_id = pr.id
JOIN patterns p ON p.id = ps.subpattern_id
LEFT JOIN user_problem_progress upp
    ON upp.problem_id = pr.id AND upp.user_id = sqlc.arg(user_id)::bigint
LEFT JOIN review_schedules rs
    ON rs.problem_id = pr.id AND rs.user_id = sqlc.arg(user_id)::bigint
WHERE co.code = sqlc.arg(company_code)::text
ORDER BY p.code, ps.tier, pr.title;

-- Card summaries for a taxonomy node's detail view (shared + own cards).
-- name: ListPatternCardSummaries :many
SELECT
    c.id,
    c.type,
    c.question,
    rs.next_review_at,
    rs.last_rating
FROM cards c
LEFT JOIN review_schedules rs
    ON rs.card_id = c.id AND rs.user_id = sqlc.arg(user_id)::bigint
WHERE c.pattern_id = sqlc.arg(pattern_id)::bigint
  AND (c.user_id IS NULL OR c.user_id = sqlc.arg(user_id)::bigint)
ORDER BY c.created_at, c.id;
