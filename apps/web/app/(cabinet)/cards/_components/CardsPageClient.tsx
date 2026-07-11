"use client";

import { useEffect, useMemo, useState } from "react";

import { ApiError } from "../../../_api/types";
import { cardTypeLabel, getCards, type CardListItem } from "../../../_api/cards";
import { CabinetPanel, StatusPill } from "../../_components";

type Tone = "default" | "accent" | "success" | "warning" | "danger";
type LoadState = "loading" | "loaded" | "error";

type CardsPageCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  panelEyebrow: string;
  panelTitle: string;
  cardUnit: string;
  searchPlaceholder: string;
  searchAria: string;
  filterAll: string;
  types: readonly (readonly [string, string])[];
  statuses: Readonly<Record<string, readonly [string, string]>>;
  reveal: string;
  hide: string;
  nextLabel: string;
  noReview: string;
  dueNow: string;
  empty: string;
  emptyAll: string;
  loading: string;
  errorTitle: string;
  retry: string;
  loadMore: string;
}>;

const nextReviewFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatNextReview(value: string | null, copy: CardsPageCopy) {
  if (!value) return copy.noReview;
  const next = new Date(value);
  if (Number.isNaN(next.getTime())) return copy.noReview;
  if (next.getTime() <= Date.now()) return copy.dueNow;
  return nextReviewFormatter.format(next).replace(".", "");
}

/** Колода прегенерированных карточек: смотреть, искать, проверять себя.
    Запуск повторения — короткий CTA, сама работа живёт в фокус-сессии. */
export function CardsPageClient({ copy }: Readonly<{ copy: CardsPageCopy }>) {
  const [cards, setCards] = useState<CardListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [revealedId, setRevealedId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoadState("loading");
    setError("");

    getCards({}, controller.signal)
      .then((response) => {
        setCards(response.data);
        setNextCursor(response.meta?.nextCursor ?? null);
        setLoadState("loaded");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setCards([]);
        setError(e instanceof ApiError ? e.message : copy.errorTitle);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [copy.errorTitle, reloadVersion]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await getCards({ cursor: nextCursor });
      setCards((current) => [...current, ...response.data]);
      setNextCursor(response.meta?.nextCursor ?? null);
    } catch {
      // Кнопка остаётся — можно повторить; уже загруженное не трогаем.
    } finally {
      setLoadingMore(false);
    }
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (typeFilter !== "all" && card.type !== typeFilter) return false;
      if (!needle) return true;
      return (
        card.front.toLowerCase().includes(needle) ||
        card.back.toLowerCase().includes(needle) ||
        card.source.label.toLowerCase().includes(needle)
      );
    });
  }, [cards, query, typeFilter]);

  const countLabel = loadState === "loading" ? "..." : cards.length;

  return (
    <main className="cabinet-page cards-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </section>

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
            className={typeFilter === "all" ? "is-active" : undefined}
            type="button"
            aria-pressed={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
          >
            {copy.filterAll}
            <em>{cards.length}</em>
          </button>
          {copy.types.map(([key, label]) => {
            const count = cards.filter((card) => card.type === key).length;
            return (
              <button
                className={typeFilter === key ? "is-active" : undefined}
                key={key}
                type="button"
                aria-pressed={typeFilter === key}
                onClick={() => setTypeFilter(key)}
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
            {visible.length} / {cards.length}
          </span>
        }
      >
        <div className="deck-list">
          {loadState === "loading" ? (
            <div className="review-list__state" role="status" aria-live="polite">
              {copy.loading}
            </div>
          ) : null}

          {loadState === "error" ? (
            <div className="review-list__state review-list__state--error" role="alert">
              <strong>{copy.errorTitle}</strong>
              {error ? <p>{error}</p> : null}
              <button type="button" onClick={() => setReloadVersion((version) => version + 1)}>
                {copy.retry}
              </button>
            </div>
          ) : null}

          {loadState === "loaded"
            ? visible.map((card) => {
                const status = copy.statuses[card.status];
                const revealed = revealedId === card.id;
                return (
                  <article className="deck-card" key={card.id}>
                    <div className="deck-card__main">
                      <div className="deck-card__meta">
                        <span className="deck-card__type">{cardTypeLabel(card.type)}</span>
                        <em>{card.source.label}</em>
                      </div>
                      <strong className="deck-card__front">{card.front}</strong>
                      {revealed ? <p className="deck-card__back">{card.back}</p> : null}
                      <button
                        className="review-action review-action--ghost"
                        type="button"
                        aria-expanded={revealed}
                        onClick={() => setRevealedId(revealed ? null : card.id)}
                      >
                        {revealed ? copy.hide : copy.reveal}
                      </button>
                    </div>
                    <div className="deck-card__side">
                      <StatusPill tone={(status?.[1] ?? "default") as Tone}>
                        {status?.[0] ?? card.status}
                      </StatusPill>
                      <span className="deck-card__next">
                        {copy.nextLabel} · {formatNextReview(card.nextReviewAt, copy)}
                      </span>
                    </div>
                  </article>
                );
              })
            : null}

          {loadState === "loaded" && visible.length === 0 ? (
            <div className="data-table__empty">
              {cards.length === 0 ? copy.emptyAll : copy.empty}
            </div>
          ) : null}
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
