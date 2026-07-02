"use client";

import { useState } from "react";

import { CabinetPanel } from "../../_components";

type ReviewItem = Readonly<{
  id: number | string;
  title: string;
  meta: string;
  type: string;
  next: string;
  rating: string;
  ratingLabel: string;
  attemptsLabel: string;
}>;

type ReviewsBoardCopy = Readonly<{
  filterAll: string;
  panelEyebrow: string;
  panelTitle: string;
  summaryUnit: string;
  empty: string;
  loading: string;
  errorTitle: string;
  retry: string;
}>;

type LoadState = "loading" | "loaded" | "error";

/** FSRS rating → tone token (blue / green / amber). */
const ratingTone: Record<string, string> = {
  normal: "accent",
  easy: "success",
  hard: "warning",
  new: "default",
};

export function ReviewsBoard({
  items,
  types,
  copy,
  loadState = "loaded",
  errorMessage,
  onRetry,
}: Readonly<{
  items: readonly ReviewItem[];
  types: readonly (readonly [string, string, string])[];
  copy: ReviewsBoardCopy;
  loadState?: LoadState;
  errorMessage?: string;
  onRetry?: () => void;
}>) {
  const [filter, setFilter] = useState("all");

  const typeTones = new Map(types.map(([key, , tone]) => [key, tone]));
  const visible = filter === "all" ? items : items.filter((item) => item.type === filter);

  return (
    <>
      <div className="cabinet-toolbar">
        <div className="filter-tabs">
          <button
            className={filter === "all" ? "is-active" : undefined}
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            {copy.filterAll}
            <em>{items.length}</em>
          </button>
          {types.map(([key, label]) => {
            const count = items.filter((item) => item.type === key).length;
            return (
              <button
                className={filter === key ? "is-active" : undefined}
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
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
        <div className="review-list">
          {loadState === "loading" ? (
            <div className="review-list__state" role="status" aria-live="polite">
              {copy.loading}
            </div>
          ) : null}

          {loadState === "error" ? (
            <div className="review-list__state review-list__state--error" role="alert">
              <strong>{copy.errorTitle}</strong>
              {errorMessage ? <p>{errorMessage}</p> : null}
              {onRetry ? (
                <button type="button" onClick={onRetry}>
                  {copy.retry}
                </button>
              ) : null}
            </div>
          ) : null}

          {loadState === "loaded"
            ? visible.map((item) => {
                const [day, time] = item.next.split(" · ");
                const tone = typeTones.get(item.type) ?? "accent";
                const badge = ratingTone[item.rating] ?? "accent";
                return (
                  <article className="review-list__item" key={item.id}>
                    <div className="review-list__main">
                      <div className="review-list__title-row">
                        <span className={`review-type review-type--${tone}`} aria-hidden="true" />
                        <strong>{item.title}</strong>
                      </div>
                      <p>{item.meta}</p>
                    </div>
                    <div className="review-list__side">
                      <span className="review-when">
                        {time ? (
                          <>
                            <em>{day} · </em>
                            {time}
                          </>
                        ) : (
                          <em>{day}</em>
                        )}
                      </span>
                      <span className="review-list__rating">
                        <span className={`review-badge review-badge--${badge}`}>
                          {item.ratingLabel}
                        </span>
                        <em>{item.attemptsLabel}</em>
                      </span>
                    </div>
                  </article>
                );
              })
            : null}
          {loadState === "loaded" && visible.length === 0 ? (
            <div className="data-table__empty">{copy.empty}</div>
          ) : null}
        </div>
      </CabinetPanel>
    </>
  );
}
