package companies

import "strings"

const (
	defaultSearchLimit = 8
	maxSearchLimit     = 20
)

type companyEntry struct {
	Company
	aliases []string
}

// catalog is an intentionally static, in-memory list of companies for
// autocomplete suggestions. There is no companies table/repository behind
// this endpoint by design: the catalog is small, changes rarely, and doesn't
// need per-user data or persistence. Revisit only if we need user-submitted
// companies or a size that no longer fits in code.
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

func Search(query string, limit int) []Company {
	query = strings.ToLower(strings.TrimSpace(query))
	if query == "" {
		return []Company{}
	}

	limit = clampLimit(limit)
	results := make([]Company, 0, limit)
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

// Lookup resolves a free-text company name (as stored in users.target_company)
// to a catalog entry by exact, case-insensitive match against the name or any
// alias. Returns ok=false when the name is absent from the catalog, in which
// case callers fall back to {code: null, name: <string>}.
func Lookup(name string) (Company, bool) {
	name = strings.ToLower(strings.TrimSpace(name))
	if name == "" {
		return Company{}, false
	}
	for _, entry := range catalog {
		if strings.ToLower(entry.Name) == name {
			return entry.Company, true
		}
		for _, alias := range entry.aliases {
			if strings.ToLower(alias) == name {
				return entry.Company, true
			}
		}
	}
	return Company{}, false
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

func clampLimit(limit int) int {
	if limit <= 0 {
		return defaultSearchLimit
	}
	if limit > maxSearchLimit {
		return maxSearchLimit
	}
	return limit
}
