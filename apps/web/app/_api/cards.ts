"use client";

import { apiFetch, apiFetchEnvelope } from "./client";

export type CardType = "pattern_recognition" | "algorithm_mechanics" | "edge_case";
export type CardRating = "hard" | "normal" | "easy";
export type CardStatus = "new" | "due" | "learning" | "mastered";
export type SessionScope = "due" | "hard_normal" | "all" | "practice";

export type SessionSourceCard = {
  id: number;
  type: CardType;
  sourceLabel: string;
  front: string;
  back: string;
  /** Shipped by the backend since issue #227; kept optional so older payloads parse. */
  createdByAi?: boolean;
  reviewState: {
    attempts: number;
    lastRating: CardRating | null;
    nextReviewAt: string | null;
  };
};

export type CardSession = {
  sessionId: string;
  scope: SessionScope;
  estimatedMinutes: number;
  cards: SessionSourceCard[];
};

export type GetCardSessionParams = {
  patternCode?: string;
  scope?: SessionScope;
  limit?: number;
};

export function getCardSession(params: GetCardSessionParams = {}, signal?: AbortSignal) {
  const query = new URLSearchParams({ scope: params.scope ?? "due" });
  if (params.patternCode) query.set("patternCode", params.patternCode);
  if (params.limit) query.set("limit", String(params.limit));
  return apiFetch<CardSession>(`/me/cards/session?${query}`, { signal });
}

export type RateCardResult = {
  cardId: number;
  rating: CardRating;
  nextReviewAt: string;
  repeatInCurrentSession: boolean;
  sessionProgress: {
    reviewed: number;
    total: number;
    remaining: number;
  };
};

/** Persists a review rating (POST /me/cards/{cardId}/rate). */
export function rateCard(
  cardId: number | string,
  body: { sessionId: string; rating: CardRating; reviewedAt: string },
  signal?: AbortSignal,
) {
  return apiFetch<RateCardResult>(`/me/cards/${cardId}/rate`, { method: "POST", body, signal });
}

const cardTypeLabels: Record<CardType, string> = {
  pattern_recognition: "Pattern Recognition",
  algorithm_mechanics: "Algorithm Mechanics",
  edge_case: "Edge Case",
};

export function cardTypeLabel(type: string): string {
  return cardTypeLabels[type as CardType] ?? type;
}

/** Maps the backend's rich session card shape onto the flat shape FocusCardReviewSession expects. */
export function toReviewCards(cards: readonly SessionSourceCard[]) {
  return cards.map((card) => ({
    id: String(card.id),
    type: cardTypeLabel(card.type),
    source: card.sourceLabel,
    front: card.front,
    back: card.back,
    createdByAi: card.createdByAi === true,
  }));
}

// ---- Колода: GET /me/cards ------------------------------------------------

export type CardListItem = {
  id: number;
  type: CardType | string;
  source: {
    entityType: string;
    entityId: number | null;
    label: string;
  };
  front: string;
  back: string;
  status: CardStatus | string;
  nextReviewAt: string | null;
  lastRating: CardRating | null;
  createdAt: string;
};

export type CardsMeta = {
  nextCursor: string | null;
};

export type GetCardsParams = {
  type?: CardType;
  patternCode?: string;
  limit?: number;
  cursor?: string;
};

export function getCards(params: GetCardsParams = {}, signal?: AbortSignal) {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.patternCode) query.set("patternCode", params.patternCode);
  query.set("limit", String(params.limit ?? 100));
  if (params.cursor) query.set("cursor", params.cursor);
  return apiFetchEnvelope<CardListItem[], CardsMeta>(`/me/cards?${query}`, { signal });
}
