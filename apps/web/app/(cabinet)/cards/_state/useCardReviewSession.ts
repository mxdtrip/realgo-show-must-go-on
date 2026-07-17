"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type ReviewRating = "hard" | "normal" | "easy";

export type ReviewCard = {
  id: string;
  type: string;
  source: string;
  front: string;
  back: string;
  /** Marks AI-generated cards; absent means false. */
  createdByAi?: boolean;
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
  sessionCardIds: string[];
};

const storageKey = "realgo:card-review-session:v1";
const replayableRatings = new Set<ReviewRating>(["hard", "normal"]);
const replayRatingPriority: Record<ReviewRating, number> = {
  hard: 0,
  normal: 1,
  easy: 2,
};

function initialQueue(cards: readonly ReviewCard[]) {
  return cards.map((card) => card.id);
}

function initialSession(cards: readonly ReviewCard[]): StoredSession {
  const cardIds = initialQueue(cards);
  return { history: [], queue: cardIds, sessionCardIds: cardIds };
}

function priorityReplayQueue(history: readonly ReviewLog[], cards: readonly ReviewCard[]) {
  const validIds = new Set(cards.map((card) => card.id));
  const latestReviewByCard = new Map<string, ReviewLog>();

  for (const item of history) {
    if (!validIds.has(item.cardId) || latestReviewByCard.has(item.cardId)) continue;
    latestReviewByCard.set(item.cardId, item);
  }

  return [...latestReviewByCard.values()]
    .filter((item) => replayableRatings.has(item.rating))
    .sort((first, second) => {
      const ratingDiff = replayRatingPriority[first.rating] - replayRatingPriority[second.rating];
      if (ratingDiff !== 0) return ratingDiff;
      return Date.parse(second.reviewedAt) - Date.parse(first.reviewedAt);
    })
    .map((item) => item.cardId);
}

function readStoredSession(cards: readonly ReviewCard[]): StoredSession {
  if (typeof window === "undefined") {
    return initialSession(cards);
  }

  const fallback = initialSession(cards);
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    const validIds = new Set(cards.map((card) => card.id));
    const queue = Array.isArray(parsed.queue)
      ? parsed.queue.filter((id): id is string => typeof id === "string" && validIds.has(id))
      : fallback.queue;
    const sessionCardIds = Array.isArray(parsed.sessionCardIds)
      ? parsed.sessionCardIds.filter((id): id is string => typeof id === "string" && validIds.has(id))
      : fallback.sessionCardIds;
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

    // Nothing stored matches the current card set (an older session with
    // different card ids was persisted) — start fresh instead of instantly
    // showing a "completed" empty queue.
    if (sessionCardIds.length === 0) return fallback;

    return { queue, history, sessionCardIds };
  } catch {
    return fallback;
  }
}

export function useCardReviewSession(
  cards: readonly ReviewCard[],
  nextReviewByRating: Record<ReviewRating, string>,
  onSessionComplete?: () => void,
  /** Persists a rating before local session state is advanced. */
  onRate?: (cardId: string, rating: ReviewRating, reviewedAt: string) => void | Promise<void>,
) {
  const [isReady, setIsReady] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [history, setHistory] = useState<ReviewLog[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionCardIds, setSessionCardIds] = useState<string[]>([]);

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  useEffect(() => {
    const stored = readStoredSession(cards);
    setQueue(stored.queue);
    setHistory(stored.history);
    setSessionCardIds(stored.sessionCardIds);
    setIsReady(true);
  }, [cards]);

  useEffect(() => {
    if (!isReady) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ history, queue, sessionCardIds }));
  }, [history, isReady, queue, sessionCardIds]);

  const currentCard = queue.length > 0 ? cardsById.get(queue[0]) : undefined;
  const completedUnique = Math.max(0, sessionCardIds.length - new Set(queue).size);
  const dueReplayQueue = useMemo(() => priorityReplayQueue(history, cards), [cards, history]);
  const progressPercent = sessionCardIds.length === 0 ? 0 : Math.round((completedUnique / sessionCardIds.length) * 100);

  const rate = useCallback(
    async (rating: ReviewRating) => {
      const currentId = queue[0];
      if (!currentId) return;

      const logItem: ReviewLog = {
        cardId: currentId,
        rating,
        reviewedAt: new Date().toISOString(),
        nextReview: nextReviewByRating[rating],
      };

      await onRate?.(currentId, rating, logItem.reviewedAt);

      // Reset the face before exposing the next queue item. Keeping this
      // ordering prevents a fast click on the newly rendered card from being
      // overwritten by the previous card's late flip reset.
      setIsFlipped(false);
      setHistory((currentHistory) => [logItem, ...currentHistory].slice(0, 12));
      setQueue((currentQueue) => {
        const [, ...rest] = currentQueue;
        const nextQueue = rating === "hard" ? [...rest, currentId] : rest;
        if (nextQueue.length === 0) {
          window.setTimeout(() => onSessionComplete?.(), 0);
        }
        return nextQueue;
      });
    },
    [nextReviewByRating, onRate, onSessionComplete, queue],
  );

  const reset = useCallback(() => {
    const cardIds = initialQueue(cards);
    setQueue(cardIds);
    setSessionCardIds(cardIds);
    setHistory([]);
    setIsFlipped(false);
  }, [cards]);

  const replayDue = useCallback(() => {
    const nextQueue = dueReplayQueue.length > 0 ? dueReplayQueue : initialQueue(cards);
    setQueue(nextQueue);
    setSessionCardIds(nextQueue);
    setIsFlipped(false);
  }, [cards, dueReplayQueue]);

  return {
    completedUnique,
    currentCard,
    dueReplayCount: dueReplayQueue.length,
    history,
    isComplete: isReady && queue.length === 0,
    isFlipped,
    isReady,
    progressPercent,
    queue,
    rate,
    replayDue,
    reset,
    setIsFlipped,
    totalCards: sessionCardIds.length,
  };
}
