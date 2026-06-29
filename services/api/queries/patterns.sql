-- name: ListWeakPatterns :many
SELECT
    pt.code AS pattern_code,
    pt.name AS pattern_name,
    COUNT(*)::integer AS review_count,
    COUNT(*) FILTER (WHERE ra.rating = 'hard')::integer AS hard_count
FROM review_attempts ra
LEFT JOIN roadmap_items ri
    ON ri.problem_id = ra.problem_id AND ri.roadmap_code = 'neetcode_150'
JOIN patterns pt ON pt.id = COALESCE(ra.pattern_id, ri.pattern_id)
WHERE ra.user_id = $1
GROUP BY pt.code, pt.name
HAVING COUNT(*) FILTER (WHERE ra.rating = 'hard') > 0
ORDER BY hard_count DESC, review_count DESC, pattern_name ASC
LIMIT $2;
