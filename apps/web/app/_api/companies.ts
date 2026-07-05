"use client";

import { apiFetch } from "./client";

export type Company = {
  id: string;
  name: string;
  source: string;
};

/**
 * GET /companies/search — auth-required company autocomplete.
 * Returns up to `limit` companies whose name or aliases contain `query`
 * (case-insensitive). Empty query returns an empty array.
 */
export function searchCompanies(query: string, signal?: AbortSignal, limit = 8) {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return apiFetch<Company[]>(`/companies/search?${params}`, { signal });
}
