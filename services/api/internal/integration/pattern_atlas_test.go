//go:build integration

package integration

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestPatternAtlasTaxonomyIntegrity is the acceptance criterion for
// Realgo Taxonomy v1: exactly 13 tools, 22 pattern families and 72
// subpatterns, with every subpattern attached to at least one family and at
// least one tool prerequisite.
func TestPatternAtlasTaxonomyIntegrity(t *testing.T) {
	h := newContractHarness(t)

	counts := map[string]int{}
	rows, err := h.pg.Pool.Query(h.ctx,
		`SELECT kind, COUNT(*) FROM patterns WHERE taxonomy_version = 'realgo-v1' GROUP BY kind`)
	require.NoError(t, err)
	defer rows.Close()
	for rows.Next() {
		var kind string
		var count int
		require.NoError(t, rows.Scan(&kind, &count))
		counts[kind] = count
	}
	require.NoError(t, rows.Err())

	require.Equal(t, 13, counts["tool"], "tools")
	require.Equal(t, 22, counts["family"], "pattern families")
	require.Equal(t, 72, counts["subpattern"], "subpatterns")

	var orphanFamilies int
	require.NoError(t, h.pg.Pool.QueryRow(h.ctx, `
		SELECT COUNT(*) FROM patterns p
		WHERE p.kind = 'subpattern' AND p.taxonomy_version = 'realgo-v1'
		  AND NOT EXISTS (SELECT 1 FROM pattern_family_subpatterns e WHERE e.subpattern_id = p.id)
	`).Scan(&orphanFamilies))
	require.Zero(t, orphanFamilies, "every subpattern must belong to a family")

	var orphanTools int
	require.NoError(t, h.pg.Pool.QueryRow(h.ctx, `
		SELECT COUNT(*) FROM patterns p
		WHERE p.kind = 'subpattern' AND p.taxonomy_version = 'realgo-v1'
		  AND NOT EXISTS (SELECT 1 FROM subpattern_prerequisites sp WHERE sp.subpattern_id = p.id)
	`).Scan(&orphanTools))
	require.Zero(t, orphanTools, "every subpattern must have at least one tool prerequisite")

	// Many-to-many really used: at least one subpattern depends on 2+ tools.
	var multiPrereq int
	require.NoError(t, h.pg.Pool.QueryRow(h.ctx, `
		SELECT COUNT(*) FROM (
			SELECT subpattern_id FROM subpattern_prerequisites GROUP BY subpattern_id HAVING COUNT(*) > 1
		) multi
	`).Scan(&multiPrereq))
	require.Positive(t, multiPrereq, "expected subpatterns with multiple prerequisites")
}

// TestPatternAtlasEndpoints drives the atlas API end to end: tree payload,
// company overlay from real evidence rows, node detail with many-to-many
// problem links.
func TestPatternAtlasEndpoints(t *testing.T) {
	h := newContractHarness(t)

	email := fmt.Sprintf("atlas-%d@integration.test", time.Now().UnixNano())
	tokens := h.register(t, email, "atlas-password-123")
	t.Cleanup(func() { h.cleanupUser(email) })

	// Fixture: one company with relevance on two subpatterns, one problem
	// practicing two subpatterns.
	companyCode := fmt.Sprintf("cmp_it_%d", time.Now().UnixNano())
	var companyID int64
	require.NoError(t, h.pg.Pool.QueryRow(h.ctx,
		`INSERT INTO companies (code, name) VALUES ($1, 'Integration Test Co') RETURNING id`,
		companyCode).Scan(&companyID))
	t.Cleanup(func() { _, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM companies WHERE id = $1`, companyID) })

	_, err := h.pg.Pool.Exec(h.ctx, `
		INSERT INTO subpattern_companies (subpattern_id, company_id, relevance, confidence, evidence_count, last_seen_at, source_type)
		SELECT p.id, $1, v.relevance, 'medium', 3, '2026-05-01'::date, 'dataset'
		FROM (VALUES ('binary_search_on_answer', 'high'), ('multi_source_bfs', 'medium')) AS v(code, relevance)
		JOIN patterns p ON p.code = v.code
	`, companyID)
	require.NoError(t, err)

	slug := fmt.Sprintf("atlas-it-%d", time.Now().UnixNano())
	var problemID int64
	require.NoError(t, h.pg.Pool.QueryRow(h.ctx, `
		INSERT INTO problems (platform_id, external_slug, title, url, difficulty, source_type)
		SELECT id, $1, 'Atlas Integration Problem', 'https://example.test/p', 'medium', 'manual'
		FROM platforms WHERE code = 'generic'
		RETURNING id
	`, slug).Scan(&problemID))
	t.Cleanup(func() { _, _ = h.pg.Pool.Exec(h.ctx, `DELETE FROM problems WHERE id = $1`, problemID) })

	_, err = h.pg.Pool.Exec(h.ctx, `
		INSERT INTO problem_subpatterns (problem_id, subpattern_id, tier, position)
		SELECT $1, p.id, 'core', 99 FROM patterns p WHERE p.code IN ('binary_search_on_answer', 'exact_search_monotone')
	`, problemID)
	require.NoError(t, err)

	// 1. Atlas without a company: full taxonomy, no overlay.
	resp := h.request(t, http.MethodGet, "/api/v1/me/patterns/atlas", tokens.access, nil)
	require.Equal(t, http.StatusOK, resp.status, resp.raw)
	data := resp.body["data"].(map[string]any)
	require.Equal(t, "realgo-v1", data["taxonomy_version"])
	require.Len(t, data["tools"].([]any), 13)
	require.Len(t, data["families"].([]any), 22)
	require.Len(t, data["subpatterns"].([]any), 72)
	require.Nil(t, data["company"])

	// 2. Companies list contains the fixture company.
	resp = h.request(t, http.MethodGet, "/api/v1/me/patterns/atlas/companies", tokens.access, nil)
	require.Equal(t, http.StatusOK, resp.status, resp.raw)
	companies := resp.body["data"].(map[string]any)["companies"].([]any)
	foundCompany := false
	for _, raw := range companies {
		company := raw.(map[string]any)
		if company["code"] == companyCode {
			foundCompany = true
			require.EqualValues(t, 2, company["subpattern_count"])
		}
	}
	require.True(t, foundCompany, "fixture company missing from atlas companies")

	// 3. Overlay: relevance markers + coverage buckets.
	resp = h.request(t, http.MethodGet, "/api/v1/me/patterns/atlas?company="+companyCode, tokens.access, nil)
	require.Equal(t, http.StatusOK, resp.status, resp.raw)
	data = resp.body["data"].(map[string]any)
	overlay := data["company"].(map[string]any)
	require.Equal(t, companyCode, overlay["code"])
	coverage := overlay["coverage"].(map[string]any)
	require.EqualValues(t, 2, coverage["relevant_subpatterns"])
	markers := 0
	for _, raw := range data["subpatterns"].([]any) {
		sub := raw.(map[string]any)
		if rel, ok := sub["relevance"].(map[string]any); ok {
			markers++
			require.Equal(t, "dataset", rel["source_type"])
		}
	}
	require.Equal(t, 2, markers, "exactly the two seeded subpatterns must carry relevance")

	// 4. Unknown company is a 404, not fabricated data.
	resp = h.request(t, http.MethodGet, "/api/v1/me/patterns/atlas?company=cmp_missing", tokens.access, nil)
	require.Equal(t, http.StatusNotFound, resp.status, resp.raw)

	// 5. Node detail: subpattern with families, tools, practice from the
	// many-to-many link, relevant companies.
	resp = h.request(t, http.MethodGet, "/api/v1/me/patterns/atlas/binary_search_on_answer", tokens.access, nil)
	require.Equal(t, http.StatusOK, resp.status, resp.raw)
	node := resp.body["data"].(map[string]any)
	require.Equal(t, "subpattern", node["kind"])
	require.NotEmpty(t, node["families"], "subpattern must reference its families")
	require.NotEmpty(t, node["tools"], "subpattern must reference its tool prerequisites")

	practice := node["practice"].([]any)
	foundProblem := false
	for _, raw := range practice {
		problem := raw.(map[string]any)
		if problem["title"] == "Atlas Integration Problem" {
			foundProblem = true
		}
	}
	require.True(t, foundProblem, "linked problem missing from practice")

	relevantCompanies := node["relevant_companies"].([]any)
	foundRelevant := false
	for _, raw := range relevantCompanies {
		company := raw.(map[string]any)
		if company["code"] == companyCode {
			foundRelevant = true
			require.Equal(t, "high", company["relevance"])
		}
	}
	require.True(t, foundRelevant, "company missing from relevant_companies")

	// The same problem must also appear under the second linked subpattern.
	resp = h.request(t, http.MethodGet, "/api/v1/me/patterns/atlas/exact_search_monotone", tokens.access, nil)
	require.Equal(t, http.StatusOK, resp.status, resp.raw)
	node = resp.body["data"].(map[string]any)
	foundProblem = false
	for _, raw := range node["practice"].([]any) {
		problem := raw.(map[string]any)
		if problem["title"] == "Atlas Integration Problem" {
			foundProblem = true
		}
	}
	require.True(t, foundProblem, "problem must be shared across subpatterns (many-to-many)")

	// 6. Auth is enforced.
	resp = h.request(t, http.MethodGet, "/api/v1/me/patterns/atlas", "", nil)
	require.Equal(t, http.StatusUnauthorized, resp.status, resp.raw)
}
