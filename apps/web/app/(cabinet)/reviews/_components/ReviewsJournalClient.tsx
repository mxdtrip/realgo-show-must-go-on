"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "../../../_api/types";
import { getProblems, type ProblemListItem } from "../../../_api/problems";
import { CabinetPanel, StatusPill } from "../../_components";

type Tone = "default" | "accent" | "success" | "warning" | "danger";
type LoadState = "loading" | "loaded" | "error";

type ReviewsJournalCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  summaryUnit: string;
  panelEyebrow: string;
  panelTitle: string;
  searchPlaceholder: string;
  searchAria: string;
  filterAll: string;
  empty: string;
  emptyAll: string;
  emptyAllCta: string;
  loading: string;
  errorTitle: string;
  retry: string;
  loadMore: string;
  noValue: string;
  hintsNone: string;
  columns: Readonly<{
    problem: string;
    platform: string;
    pattern: string;
    status: string;
    hints: string;
    rating: string;
  }>;
  statuses: readonly (readonly [string, string, string])[];
  difficulty: Readonly<Record<string, string>>;
  ratings: Readonly<Record<string, string>>;
}>;

const difficultyTone: Record<string, string> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
};

/** Самооценка из попапа расширения → тон бейджа (как в остальном кабинете). */
const ratingTone: Record<string, string> = {
  hard: "warning",
  normal: "accent",
  easy: "success",
};

/** Журнал решённого на платформах: что зафиксировало расширение, сколько
    подсказок потрачено и как пользователь сам оценил задачу. */
export function ReviewsJournalClient({ copy, queue }: Readonly<{ copy: ReviewsJournalCopy; queue?: ReactNode }>) {
  const [problems, setProblems] = useState<ProblemListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const controller = new AbortController();

    setLoadState("loading");
    setError("");

    getProblems({}, controller.signal)
      .then((response) => {
        setProblems(response.data);
        setNextCursor(response.meta?.nextCursor ?? null);
        setLoadState("loaded");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setProblems([]);
        setError(e instanceof ApiError ? e.message : copy.errorTitle);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [copy.errorTitle, reloadVersion]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await getProblems({ cursor: nextCursor });
      setProblems((current) => [...current, ...response.data]);
      setNextCursor(response.meta?.nextCursor ?? null);
    } catch {
      // Кнопка остаётся — можно повторить; уже показанное не трогаем.
    } finally {
      setLoadingMore(false);
    }
  };

  const statusMeta = new Map(copy.statuses.map(([key, label, tone]) => [key, { label, tone }]));

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return problems.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        item.title.toLowerCase().includes(needle) ||
        (item.pattern?.name.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [problems, query, statusFilter]);

  const countLabel = loadState === "loading" ? "..." : problems.length;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="cabinet-page-head__actions">
          <span className="cabinet-next-hint">
            <em>{countLabel}</em> {copy.summaryUnit}
          </span>
        </div>
      </section>

      {queue}

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
            <em>{problems.length}</em>
          </button>
          {copy.statuses.map(([key, label]) => {
            const count = problems.filter((item) => item.status === key).length;
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
            {visible.length} / {problems.length}
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
                <th>{copy.columns.hints}</th>
                <th>{copy.columns.rating}</th>
              </tr>
            </thead>
            <tbody>
              {loadState === "loading" ? (
                <tr>
                  <td className="data-table__empty" colSpan={6} role="status" aria-live="polite">
                    {copy.loading}
                  </td>
                </tr>
              ) : null}

              {loadState === "error" ? (
                <tr>
                  <td className="data-table__empty" colSpan={6} role="alert">
                    <strong>{copy.errorTitle}</strong>
                    {error ? <> · {error}</> : null}{" "}
                    <button
                      className="review-action review-action--ghost"
                      type="button"
                      onClick={() => setReloadVersion((version) => version + 1)}
                    >
                      {copy.retry}
                    </button>
                  </td>
                </tr>
              ) : null}

              {loadState === "loaded"
                ? visible.map((item) => {
                    const meta = statusMeta.get(item.status);
                    const difficulty = copy.difficulty[item.difficulty];
                    const rating = item.lastRating ? copy.ratings[item.lastRating] : null;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="problem-cell">
                            <a
                              className="problem-cell__link"
                              href={item.url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {item.title}
                              <span aria-hidden="true">↗</span>
                            </a>
                            {difficulty ? (
                              <span
                                className={`difficulty-text difficulty-text--${
                                  difficultyTone[item.difficulty] ?? "unknown"
                                }`}
                              >
                                {difficulty}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <span className="meta-chip">{item.platform}</span>
                        </td>
                        <td className="data-table__mono">
                          {item.pattern ? (
                            <Link className="problem-cell__pattern" href={`/patterns/${item.pattern.id}`}>
                              {item.pattern.name}
                            </Link>
                          ) : (
                            copy.noValue
                          )}
                        </td>
                        <td>
                          <StatusPill tone={(meta?.tone ?? "default") as Tone}>
                            {meta?.label ?? item.status}
                          </StatusPill>
                        </td>
                        <td className="data-table__mono">
                          {item.hintsUsed > 0 ? item.hintsUsed : copy.hintsNone}
                        </td>
                        <td>
                          {rating ? (
                            <span className={`review-badge review-badge--${ratingTone[item.lastRating ?? ""] ?? "default"}`}>
                              {rating}
                            </span>
                          ) : (
                            <span className="data-table__mono">{copy.noValue}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                : null}

              {loadState === "loaded" && visible.length === 0 ? (
                <tr>
                  <td className="data-table__empty" colSpan={6}>
                    {problems.length === 0 ? (
                      <>
                        {copy.emptyAll}{" "}
                        <Link className="problem-cell__pattern" href="/extension">
                          {copy.emptyAllCta}
                        </Link>
                      </>
                    ) : (
                      copy.empty
                    )}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {loadState === "loaded" && nextCursor ? (
          <div className="data-table-more">
            <button
              className="review-action review-action--ghost"
              disabled={loadingMore}
              type="button"
              onClick={() => void loadMore()}
            >
              {copy.loadMore}
            </button>
          </div>
        ) : null}
      </CabinetPanel>
    </main>
  );
}
