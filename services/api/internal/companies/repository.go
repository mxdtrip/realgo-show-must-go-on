package companies

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/freeburger/services/api/internal/storage/postgres/db"
)

const (
	defaultSearchLimit = 8
	maxSearchLimit     = 20
)

type companyEntry struct {
	Company
	aliases []string
}

// catalog is the curated alias layer on top of the companies table: it keeps
// canonical display names and the alias matches (facebook -> Meta, gcp ->
// Google Cloud) that a plain ILIKE over the table cannot provide. The bulk of
// the suggestions now comes from the companies table, populated by the
// company-problems dataset seed.
var catalog = []companyEntry{
	{Company: Company{ID: "cmp_google", Name: "Google", Source: "manual"}, aliases: []string{"alphabet"}},
	{Company: Company{ID: "cmp_google_cloud", Name: "Google Cloud", Source: "manual"}, aliases: []string{"gcp"}},
	{Company: Company{ID: "cmp_amazon", Name: "Amazon", Source: "manual"}, aliases: []string{"aws", "amazon web services"}},
	{Company: Company{ID: "cmp_meta", Name: "Meta", Source: "manual"}, aliases: []string{"facebook", "instagram", "whatsapp"}},
	{Company: Company{ID: "cmp_apple", Name: "Apple", Source: "manual"}},
	{Company: Company{ID: "cmp_microsoft", Name: "Microsoft", Source: "manual"}, aliases: []string{"azure"}},
	{Company: Company{ID: "cmp_netflix", Name: "Netflix", Source: "manual"}},
	{Company: Company{ID: "cmp_yandex", Name: "Yandex", Source: "manual"}},
	{Company: Company{ID: "cmp_uber", Name: "Uber", Source: "manual"}},
	{Company: Company{ID: "cmp_airbnb", Name: "Airbnb", Source: "manual"}},
	{Company: Company{ID: "cmp_stripe", Name: "Stripe", Source: "manual"}},
	{Company: Company{ID: "cmp_databricks", Name: "Databricks", Source: "manual"}},
	{Company: Company{ID: "cmp_openai", Name: "OpenAI", Source: "manual"}},
	{Company: Company{ID: "cmp_anthropic", Name: "Anthropic", Source: "manual"}},
	{Company: Company{ID: "cmp_tesla", Name: "Tesla", Source: "manual"}},
	{Company: Company{ID: "cmp_nvidia", Name: "NVIDIA", Source: "manual"}},
	{Company: Company{ID: "cmp_adobe", Name: "Adobe", Source: "manual"}},
	{Company: Company{ID: "cmp_oracle", Name: "Oracle", Source: "manual"}},
	{Company: Company{ID: "cmp_salesforce", Name: "Salesforce", Source: "manual"}},
	{Company: Company{ID: "cmp_booking", Name: "Booking.com", Source: "manual"}, aliases: []string{"booking"}},
	{Company: Company{ID: "cmp_spotify", Name: "Spotify", Source: "manual"}},
	{Company: Company{ID: "cmp_tinkoff", Name: "Tinkoff", Source: "manual"}, aliases: []string{"t-bank", "tbank"}},
	{Company: Company{ID: "cmp_ozon", Name: "Ozon", Source: "manual"}},
	{Company: Company{ID: "cmp_avito", Name: "Avito", Source: "manual"}},
	{Company: Company{ID: "cmp_vk", Name: "VK", Source: "manual"}, aliases: []string{"vkontakte"}},
}

// Repository searches companies: curated catalog first (aliases, canonical
// names), then the companies table. A nil pool degrades to catalog-only.
type Repository struct {
	q *db.Queries
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	if pool == nil {
		return &Repository{}
	}
	return &Repository{q: db.New(pool)}
}

func (r *Repository) Search(ctx context.Context, query string, limit int) ([]Company, error) {
	query = strings.ToLower(strings.TrimSpace(query))
	limit = clampLimit(limit)
	results := searchCatalog(query, limit)
	if query == "" || r.q == nil || len(results) >= limit {
		return results, nil
	}

	rows, err := r.q.SearchCompanies(ctx, db.SearchCompaniesParams{
		Query:      escapeLike(query),
		MaxResults: int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("companies: search: %w", err)
	}

	seen := make(map[string]bool, len(results))
	for _, c := range results {
		seen[c.ID] = true
	}
	for _, row := range rows {
		if seen[row.Code] {
			continue
		}
		results = append(results, Company{ID: row.Code, Name: row.Name, Source: "dataset"})
		if len(results) >= limit {
			break
		}
	}
	return results, nil
}

func searchCatalog(query string, limit int) []Company {
	results := make([]Company, 0, limit)
	if query == "" {
		return results
	}
	for _, entry := range catalog {
		if !matches(entry, query) {
			continue
		}
		results = append(results, entry.Company)
		if len(results) >= limit {
			break
		}
	}
	return results
}

func matches(entry companyEntry, query string) bool {
	if strings.Contains(strings.ToLower(entry.Name), query) {
		return true
	}
	for _, alias := range entry.aliases {
		if strings.Contains(strings.ToLower(alias), query) {
			return true
		}
	}
	return false
}

// escapeLike neutralizes LIKE wildcards in user input so "100%" searches for
// a literal percent sign.
func escapeLike(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	return strings.ReplaceAll(s, `_`, `\_`)
}

func clampLimit(limit int) int {
	if limit <= 0 {
		return defaultSearchLimit
	}
	if limit > maxSearchLimit {
		return maxSearchLimit
	}
	return limit
}
