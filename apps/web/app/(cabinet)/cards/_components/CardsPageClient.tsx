"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "../../../_api/types";
import { cardTypeLabel, getCardSession, getCards, type CardListItem } from "../../../_api/cards";
import { getPractice } from "../../../_api/practice";
import { CabinetPanel, StatusPill } from "../../_components";
import { CabinetIcon } from "../../_icons";

type Tone = "default" | "accent" | "success" | "warning" | "danger";
type LoadState = "loading" | "loaded" | "error";

type CardsPageCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  panelEyebrow: string;
  panelTitle: string;
  start: string;
  cardUnit: string;
  dueLabel: string;
  dueNone: string;
  estimatedUnit: string;
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
  launcher: Readonly<{
    eyebrow: string;
    title: string;
    metaUnits: Readonly<{ subpatterns: string; cards: string; minutes: string }>;
    emptyTitle: string;
    emptyMeta: string;
    start: string;
    manage: string;
  }>;
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
  const [live, setLive] = useState<{ dueCount: number; estimatedMinutes: number } | null>(null);
  const [practice, setPractice] = useState<{
    subpatterns: number;
    cards: number;
    minutes: number;
  } | null>(null);

  // Авторитетные цифры «сколько к повторению» — из сессионного эндпоинта,
  // той же выборки, которую откроет CTA. Ошибка не критична: остаётся
  // оценка по загруженной колоде.
  useEffect(() => {
    const controller = new AbortController();
    getCardSession({ scope: "due" }, controller.signal)
      .then((session) => {
        setLive({ dueCount: session.cards.length, estimatedMinutes: session.estimatedMinutes });
      })
      .catch(() => {
        // Фолбэк: считаем из списка ниже.
      });
    return () => controller.abort();
  }, []);

  // Лаунчер практики: те же цифры, которые увидит /cards/session?scope=practice.
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getPractice(controller.signal),
      getCardSession({ scope: "practice" }, controller.signal),
    ])
      .then(([practiceSet, session]) => {
        setPractice({
          subpatterns: practiceSet.subpatterns.length,
          cards: session.cards.length,
          minutes: session.estimatedMinutes,
        });
      })
      .catch(() => {
        // Лаунчер показывает пустое состояние.
      });
    return () => controller.abort();
  }, []);

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

  const deckDueCount = useMemo(
    () => cards.filter((card) => card.status === "due" || card.status === "new").length,
    [cards],
  );
  const dueCount = live?.dueCount ?? deckDueCount;
  const estimatedMinutes = live?.estimatedMinutes ?? Math.ceil(deckDueCount * 0.75);

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
        <div className="cabinet-page-head__actions">
          <div>
            <Link className="cabinet-cta" href="/cards/session">
              {copy.start}
              <CabinetIcon name="arrow" />
            </Link>
          </div>
          <span className="cabinet-next-hint">
            {loadState === "loaded" && dueCount === 0 ? (
              copy.dueNone
            ) : (
              <>
                <em>{loadState === "loading" ? "..." : dueCount}</em> {copy.dueLabel} · ~
                {estimatedMinutes} {copy.estimatedUnit}
              </>
            )}
          </span>
        </div>
      </section>

      <aside className="next-up next-up--wide">
        <div className="next-up__body">
          <span className="next-up__eyebrow">{copy.launcher.eyebrow}</span>
          <strong className="next-up__title">
            {practice && practice.subpatterns > 0 ? copy.launcher.title : copy.launcher.emptyTitle}
          </strong>
          <span className="next-up__meta">
            {practice && practice.subpatterns > 0
              ? `${practice.subpatterns} ${copy.launcher.metaUnits.subpatterns} · ${practice.cards} ${copy.launcher.metaUnits.cards} · ~${practice.minutes} ${copy.launcher.metaUnits.minutes}`
              : copy.launcher.emptyMeta}
          </span>
        </div>
        <div className="next-up__actions">
          {practice && practice.subpatterns > 0 ? (
            <Link className="cabinet-cta" href="/cards/session?scope=practice">
              {copy.launcher.start}
              <CabinetIcon name="arrow" />
            </Link>
          ) : null}
          <Link className="cabinet-ghost-link" href="/problems">
            {copy.launcher.manage}
          </Link>
        </div>
      </aside>

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
