"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type ReviewRating = "hard" | "normal" | "easy";

export type ReviewCard = {
  id: string;
  type: string;
  source: string;
  front: string;
  back: string;
};

export type ReviewLog = {
  cardId: string;
  rating: ReviewRating;
  reviewedAt: string;
  nextReview: string;
};

type StoredSession = {
  queue: string[];
  history: ReviewLog[];
};

const storageKey = "engram:card-review-session:v1";

function initialQueue(cards: readonly ReviewCard[]) {
  return cards.map((card) => card.id);
}

function readStoredSession(cards: readonly ReviewCard[]): StoredSession {
  if (typeof window === "undefined") {
    return { queue: initialQueue(cards), history: [] };
  }

  const fallback = { queue: initialQueue(cards), history: [] };
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    const validIds = new Set(cards.map((card) => card.id));
    const queue = Array.isArray(parsed.queue)
      ? parsed.queue.filter((id): id is string => typeof id === "string" && validIds.has(id))
      : fallback.queue;
    const history = Array.isArray(parsed.history)
      ? parsed.history.filter(
          (item): item is ReviewLog =>
            typeof item?.cardId === "string" &&
            validIds.has(item.cardId) &&
            (item.rating === "hard" || item.rating === "normal" || item.rating === "easy") &&
            typeof item.reviewedAt === "string" &&
            typeof item.nextReview === "string",
        )
      : [];

    return { queue, history };
  } catch {
    return fallback;
  }
}

export function useCardReviewSession(
  cards: readonly ReviewCard[],
  nextReviewByRating: Record<ReviewRating, string>,
) {
  const [isReady, setIsReady] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [history, setHistory] = useState<ReviewLog[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  useEffect(() => {
    const stored = readStoredSession(cards);
    setQueue(stored.queue);
    setHistory(stored.history);
    setIsReady(true);
  }, [cards]);

  useEffect(() => {
    if (!isReady) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ queue, history }));
  }, [history, isReady, queue]);

  const currentCard = queue.length > 0 ? cardsById.get(queue[0]) : undefined;
  const completedUnique = new Set(history.filter((item) => item.rating !== "hard").map((item) => item.cardId)).size;
  const progressPercent = cards.length === 0 ? 0 : Math.round((completedUnique / cards.length) * 100);

  const rate = useCallback(
    (rating: ReviewRating) => {
      const currentId = queue[0];
      if (!currentId) return;

      const logItem: ReviewLog = {
        cardId: currentId,
        rating,
        reviewedAt: new Date().toISOString(),
        nextReview: nextReviewByRating[rating],
      };

      setHistory((currentHistory) => [logItem, ...currentHistory].slice(0, 12));
      setQueue((currentQueue) => {
        const [, ...rest] = currentQueue;
        return rating === "hard" ? [...rest, currentId] : rest;
      });
      setIsFlipped(false);
    },
    [nextReviewByRating, queue],
  );

  const reset = useCallback(() => {
    setQueue(initialQueue(cards));
    setHistory([]);
    setIsFlipped(false);
  }, [cards]);

  return {
    completedUnique,
    currentCard,
    history,
    isComplete: isReady && queue.length === 0,
    isFlipped,
    isReady,
    progressPercent,
    queue,
    rate,
    reset,
    setIsFlipped,
    totalCards: cards.length,
  };
}
