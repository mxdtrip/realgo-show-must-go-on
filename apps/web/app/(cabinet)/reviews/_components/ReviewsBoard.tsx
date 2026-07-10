"use client";

import Link from "next/link";
import { useState } from "react";

import type { ReviewRating } from "../../../_api/reviews";
import { CabinetPanel } from "../../_components";

export type ReviewBoardItem = Readonly<{
  id: number | string;
  /** problem | card | pattern — определяет действие в строке. */
  entityType: string;
  title: string;
  meta: string;
  next: string;
  rating: string;
  ratingLabel: string;
  attemptsLabel: string;
  entityUrl: string | null;
  patternCode: string | null;
}>;

type ReviewsBoardCopy = Readonly<{
  filterAll: string;
  panelEyebrow: string;
  panelTitle: string;
  summaryUnit: string;
  empty: string;
  emptyAll: string;
  loading: string;
  errorTitle: string;
  retry: string;
  actions: Readonly<{
    resolve: string;
    trainPattern: string;
    inSession: string;
    rate: string;
    rateCancel: string;
    rated: string;
    rateFailed: string;
  }>;
}>;

type LoadState = "loading" | "loaded" | "error";

/** FSRS rating → tone token (blue / green / amber). */
const ratingTone: Record<string, string> = {
  normal: "accent",
  easy: "success",
  hard: "warning",
  new: "default",
};

const manuallyRatable = new Set(["problem", "pattern"]);
const ratingOrder: readonly ReviewRating[] = ["hard", "normal", "easy"];

function RowAction({
  item,
  copy,
}: Readonly<{ item: ReviewBoardItem; copy: ReviewsBoardCopy }>) {
  if (item.entityType === "problem" && item.entityUrl) {
    return (
      <a className="review-action" href={item.entityUrl} rel="noreferrer" target="_blank">
        {copy.actions.resolve}
        <span aria-hidden="true">↗</span>
      </a>
    );
  }
  if (item.entityType === "pattern" && item.patternCode) {
    return (
      <Link className="review-action" href={`/patterns/${item.patternCode}/session`}>
        {copy.actions.trainPattern}
        <span aria-hidden="true">→</span>
      </Link>
    );
  }
  if (item.entityType === "card") {
    return (
      <Link className="review-action review-action--ghost" href="/cards/session">
        {copy.actions.inSession}
        <span aria-hidden="true">→</span>
      </Link>
    );
  }
  return null;
}

export function ReviewsBoard({
  items,
  types,
  copy,
  loadState = "loaded",
  errorMessage,
  onRetry,
  onRate,
  ratingLabels,
}: Readonly<{
  items: readonly ReviewBoardItem[];
  types: readonly (readonly [string, string, string])[];
  copy: ReviewsBoardCopy;
  loadState?: LoadState;
  errorMessage?: string;
  onRetry?: () => void;
  onRate?: (item: ReviewBoardItem, rating: ReviewRating) => Promise<void>;
  ratingLabels: Readonly<Record<ReviewRating, string>>;
}>) {
  const [filter, setFilter] = useState("all");
  const [ratingOpenId, setRatingOpenId] = useState<ReviewBoardItem["id"] | null>(null);
  const [ratingBusyId, setRatingBusyId] = useState<ReviewBoardItem["id"] | null>(null);

  const typeTones = new Map(types.map(([key, , tone]) => [key, tone]));
  const visible =
    filter === "all" ? items : items.filter((item) => item.entityType === filter);

  const submitRating = async (item: ReviewBoardItem, rating: ReviewRating) => {
    if (!onRate || ratingBusyId !== null) return;
    setRatingBusyId(item.id);
    try {
      await onRate(item, rating);
      setRatingOpenId(null);
    } finally {
      setRatingBusyId(null);
    }
  };

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
            const count = items.filter((item) => item.entityType === key).length;
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
                const tone = typeTones.get(item.entityType) ?? "accent";
                const badge = ratingTone[item.rating] ?? "accent";
                const canRate = Boolean(onRate) && manuallyRatable.has(item.entityType);
                const ratingOpen = ratingOpenId === item.id;
                return (
                  <article className="review-list__item" key={item.id}>
                    <div className="review-list__main">
                      <div className="review-list__title-row">
                        <span className={`review-type review-type--${tone}`} aria-hidden="true" />
                        <strong>{item.title}</strong>
                      </div>
                      <p>{item.meta}</p>
                      <div className="review-list__actions">
                        <RowAction item={item} copy={copy} />
                        {canRate ? (
                          ratingOpen ? (
                            <span className="review-rate" role="group" aria-label={copy.actions.rate}>
                              {ratingOrder.map((rating) => (
                                <button
                                  className={`review-rate__button review-rate__button--${rating}`}
                                  disabled={ratingBusyId !== null}
                                  key={rating}
                                  type="button"
                                  onClick={() => void submitRating(item, rating)}
                                >
                                  {ratingLabels[rating]}
                                </button>
                              ))}
                              <button
                                className="review-rate__button review-rate__button--cancel"
                                disabled={ratingBusyId !== null}
                                type="button"
                                onClick={() => setRatingOpenId(null)}
                              >
                                {copy.actions.rateCancel}
                              </button>
                            </span>
                          ) : (
                            <button
                              className="review-action review-action--ghost"
                              type="button"
                              onClick={() => setRatingOpenId(item.id)}
                            >
                              {copy.actions.rate}
                            </button>
                          )
                        ) : null}
                      </div>
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
            <div className="data-table__empty">
              {items.length === 0 ? copy.emptyAll : copy.empty}
            </div>
          ) : null}
        </div>
      </CabinetPanel>
    </>
  );
}
