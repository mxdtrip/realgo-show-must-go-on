"use client";

import { apiFetch } from "./client";

export type CardType = "pattern_recognition" | "algorithm_mechanics" | "edge_case";
export type CardRating = "hard" | "normal" | "easy";
export type SessionScope = "due" | "hard_normal" | "all";

export type SessionSourceCard = {
  id: number;
  type: CardType;
  sourceLabel: string;
  front: string;
  back: string;
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

const cardTypeLabels: Record<CardType, string> = {
  pattern_recognition: "Pattern Recognition",
  algorithm_mechanics: "Algorithm Mechanics",
  edge_case: "Edge Case",
};

/** Maps the backend's rich session card shape onto the flat shape FocusCardReviewSession expects. */
export function toReviewCards(cards: readonly SessionSourceCard[]) {
  return cards.map((card) => ({
    id: String(card.id),
    type: cardTypeLabels[card.type] ?? card.type,
    source: card.sourceLabel,
    front: card.front,
    back: card.back,
  }));
}
