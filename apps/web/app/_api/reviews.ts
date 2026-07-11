"use client";

import { apiFetch, apiFetchEnvelope } from "./client";

export type ReviewEntityType = "problem" | "card" | "pattern" | string;
export type ReviewRating = "hard" | "normal" | "easy";
export type ReviewStatus = "due" | "upcoming" | "completed" | "skipped" | string;
export type ReviewID = number | string;

export type ReviewQueueItem = {
  id: ReviewID;
  entityType: ReviewEntityType;
  entityId: ReviewID;
  title: string;
  meta: string;
  typeLabel: string;
  dueAt: string;
  status: ReviewStatus;
  lastRating: ReviewRating | null;
  attempts: number;
  /** Внешняя ссылка «перерешать на платформе»; "" когда задача не привязана. */
  entityUrl: string;
  /** Код паттерна для /patterns/{code}/session; "" когда паттерн не привязан. */
  patternCode: string;
};

export type ReviewQueueMeta = {
  nextCursor: string | null;
};

export function getReviewQueue(signal?: AbortSignal) {
  const params = new URLSearchParams({ status: "due", limit: "50" });
  return apiFetchEnvelope<ReviewQueueItem[], ReviewQueueMeta>(`/me/reviews/queue?${params}`, {
    signal,
  });
}

export type RateReviewResult = {
  reviewId: number;
  rating: ReviewRating;
  nextReviewAt: string;
  status: string;
};

/** Оценить элемент очереди вручную (problem/pattern; карточки оцениваются в сессии). */
export function rateReview(reviewId: ReviewID, rating: ReviewRating) {
  return apiFetch<RateReviewResult>(`/me/reviews/${reviewId}/rate`, {
    method: "POST",
    body: { rating, reviewedAt: new Date().toISOString() },
  });
}
