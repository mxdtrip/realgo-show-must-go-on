-- Autocomplete over the companies table (populated by the company-problems
-- dataset seed). Prefix matches rank above substring matches.
-- name: SearchCompanies :many
SELECT code, name
FROM companies
WHERE name ILIKE '%' || sqlc.arg(query)::text || '%'
ORDER BY
    (name ILIKE sqlc.arg(query)::text || '%') DESC,
    name
LIMIT sqlc.arg(max_results)::int;
