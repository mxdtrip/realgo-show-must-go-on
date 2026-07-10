"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "../../../_api/types";
import {
  getReviewQueue,
  rateReview,
  type ReviewQueueItem,
  type ReviewRating,
} from "../../../_api/reviews";
import { useToast } from "../../../_toast";
import { CabinetIcon } from "../../_icons";
import { ReviewsBoard, type ReviewBoardItem } from "./ReviewsBoard";

type LoadState = "loading" | "loaded" | "error";
type ReviewTypeTuple = readonly [string, string, string];

type ReviewsPageCopy = Readonly<{
  startSession: string;
  hard: string;
  normal: string;
  easy: string;
  page: {
    eyebrow: string;
    title: string;
    description: string;
    summaryUnit: string;
    filterAll: string;
    types: readonly ReviewTypeTuple[];
    panelEyebrow: string;
    panelTitle: string;
    empty: string;
    emptyAll: string;
    loading: string;
    errorTitle: string;
    retry: string;
    today: string;
    tomorrow: string;
    dueFallback: string;
    noRating: string;
    attemptUnits: {
      one: string;
      few: string;
      many: string;
    };
    actions: {
      resolve: string;
      trainPattern: string;
      inSession: string;
      rate: string;
      rateCancel: string;
      rated: string;
      rateFailed: string;
    };
  };
}>;

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

function isReviewRating(value: string | null): value is ReviewRating {
  return value === "hard" || value === "normal" || value === "easy";
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function formatDueAt(
  dueAt: string,
  copy: {
    today: string;
    tomorrow: string;
    dueFallback: string;
  },
) {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    return copy.dueFallback;
  }

  const dayDiff = Math.round((startOfLocalDay(due) - startOfLocalDay(new Date())) / 86_400_000);
  const day =
    dayDiff === 0
      ? copy.today
      : dayDiff === 1
        ? copy.tomorrow
        : dateFormatter.format(due).replace(".", "");

  return `${day} · ${timeFormatter.format(due)}`;
}

function formatAttempts(count: number, units: { one: string; few: string; many: string }) {
  const absolute = Math.abs(count);
  const mod10 = absolute % 10;
  const mod100 = absolute % 100;
  const unit =
    mod10 === 1 && mod100 !== 11
      ? units.one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? units.few
        : units.many;

  return `${count} ${unit}`;
}

/** Очередь едина, но закрывается по-разному: карточки — сессией, задачи —
    перерешиванием на платформе (расширение запишет результат), паттерны —
    тренировкой; ручная оценка остаётся фолбэком для problem/pattern. */
export function ReviewsPageClient({ copy }: Readonly<{ copy: ReviewsPageCopy }>) {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const toast = useToast();

  useEffect(() => {
    const controller = new AbortController();

    setLoadState("loading");
    setError("");

    getReviewQueue(controller.signal)
      .then((response) => {
        setQueue(response.data);
        setLoadState("loaded");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setQueue([]);
        setError(e instanceof ApiError ? e.message : copy.page.errorTitle);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [copy.page.errorTitle, reloadVersion]);

  const ratingLabels: Record<ReviewRating, string> = useMemo(
    () => ({
      hard: copy.hard,
      normal: copy.normal,
      easy: copy.easy,
    }),
    [copy.easy, copy.hard, copy.normal],
  );

  const handleRate = async (item: ReviewBoardItem, rating: ReviewRating) => {
    try {
      const result = await rateReview(item.id, rating);
      setQueue((current) => current.filter((queued) => queued.id !== item.id));
      const next = formatDueAt(result.nextReviewAt, copy.page);
      toast.success(`${copy.page.actions.rated} ${ratingLabels[rating]} · ${next}`);
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : copy.page.actions.rateFailed);
    }
  };

  const items = useMemo(
    () =>
      queue.map((item): ReviewBoardItem => {
        const rating = isReviewRating(item.lastRating) ? item.lastRating : "new";

        return {
          id: item.id,
          entityType: item.entityType,
          title: item.title,
          meta: item.meta,
          next: formatDueAt(item.dueAt, copy.page),
          rating,
          ratingLabel: isReviewRating(item.lastRating)
            ? ratingLabels[item.lastRating]
            : copy.page.noRating,
          attemptsLabel: formatAttempts(item.attempts, copy.page.attemptUnits),
          entityUrl: item.entityUrl || null,
          patternCode: item.patternCode || null,
        };
      }),
    [copy.page, queue, ratingLabels],
  );

  const countLabel = loadState === "loading" ? "..." : items.length;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{copy.page.eyebrow}</span>
          <h1>{copy.page.title}</h1>
          <p>{copy.page.description}</p>
        </div>
        <div className="cabinet-page-head__actions">
          <div>
            <Link className="cabinet-cta" href="/cards/session">
              {copy.startSession}
              <CabinetIcon name="arrow" />
            </Link>
          </div>
          <span className="cabinet-next-hint">
            <em>{countLabel}</em> {copy.page.summaryUnit}
          </span>
        </div>
      </section>

      <ReviewsBoard
        items={items}
        types={copy.page.types}
        loadState={loadState}
        errorMessage={error}
        onRetry={() => setReloadVersion((version) => version + 1)}
        onRate={handleRate}
        ratingLabels={ratingLabels}
        copy={{
          filterAll: copy.page.filterAll,
          panelEyebrow: copy.page.panelEyebrow,
          panelTitle: copy.page.panelTitle,
          summaryUnit: copy.page.summaryUnit,
          empty: copy.page.empty,
          emptyAll: copy.page.emptyAll,
          loading: copy.page.loading,
          errorTitle: copy.page.errorTitle,
          retry: copy.page.retry,
          actions: copy.page.actions,
        }}
      />
    </main>
  );
}
