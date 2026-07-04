"use client";

import { useMemo, useState } from "react";

import { CabinetPanel, StatusPill } from "../../_components";

type Tone = "default" | "accent" | "success" | "warning" | "danger";

type ProblemItem = Readonly<{
  title: string;
  platform: string;
  pattern: string;
  status: string;
  next: string;
}>;

type ProblemsTableCopy = Readonly<{
  filterAll: string;
  searchPlaceholder: string;
  searchAria: string;
  panelEyebrow: string;
  panelTitle: string;
  empty: string;
  columns: Readonly<{
    problem: string;
    platform: string;
    pattern: string;
    status: string;
    next: string;
  }>;
}>;

export function ProblemsTable({
  items,
  statuses,
  copy,
}: Readonly<{
  items: readonly ProblemItem[];
  statuses: readonly (readonly [string, string, string])[];
  copy: ProblemsTableCopy;
}>) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const statusMeta = new Map(statuses.map(([key, label, tone]) => [key, { label, tone }]));

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        item.title.toLowerCase().includes(needle) || item.pattern.toLowerCase().includes(needle)
      );
    });
  }, [items, query, statusFilter]);

  return (
    <>
      <div className="cabinet-toolbar">
        <div className="cabinet-search">
          <input
            aria-label={copy.searchAria}
            placeholder={copy.searchPlaceholder}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="filter-tabs">
          <button
            className={statusFilter === "all" ? "is-active" : undefined}
            type="button"
            aria-pressed={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          >
            {copy.filterAll}
            <em>{items.length}</em>
          </button>
          {statuses.map(([key, label]) => {
            const count = items.filter((item) => item.status === key).length;
            return (
              <button
                className={statusFilter === key ? "is-active" : undefined}
                key={key}
                type="button"
                aria-pressed={statusFilter === key}
                onClick={() => setStatusFilter(key)}
              >
                {label}
                <em>{count}</em>
              </button>
            );
          })}
        </div>
      </div>

      <CabinetPanel
        eyebrow={copy.panelEyebrow}
        title={copy.panelTitle}
        meta={
          <span className="cabinet-panel__meta">
            {visible.length} / {items.length}
          </span>
        }
      >
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{copy.columns.problem}</th>
                <th>{copy.columns.platform}</th>
                <th>{copy.columns.pattern}</th>
                <th>{copy.columns.status}</th>
                <th>{copy.columns.next}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const meta = statusMeta.get(item.status);
                return (
                  <tr key={item.title}>
                    <td>{item.title}</td>
                    <td>
                      <span className="meta-chip">{item.platform}</span>
                    </td>
                    <td className="data-table__mono">{item.pattern}</td>
                    <td>
                      <StatusPill tone={(meta?.tone ?? "default") as Tone}>
                        {meta?.label ?? item.status}
                      </StatusPill>
                    </td>
                    <td className="data-table__mono">{item.next}</td>
                  </tr>
                );
              })}
              {visible.length === 0 ? (
                <tr>
                  <td className="data-table__empty" colSpan={5}>
                    {copy.empty}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CabinetPanel>
    </>
  );
}
