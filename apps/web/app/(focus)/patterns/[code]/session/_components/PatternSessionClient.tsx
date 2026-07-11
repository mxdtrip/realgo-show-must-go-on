"use client";

import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../../../../_api/types";
import { getCardSession, rateCard, toReviewCards, type SessionSourceCard } from "../../../../../_api/cards";
import { FocusCardReviewSession } from "../../../../../(cabinet)/cards/_components/FocusCardReviewSession";
import type { ReviewRating } from "../../../../../(cabinet)/cards/_state/useCardReviewSession";

type LoadState = "loading" | "loaded" | "empty" | "error";

export function PatternSessionClient({
  code,
  brand,
  copy,
  emptyMessage,
  errorFallback,
}: Readonly<{
  code: string;
  brand: string;
  copy: ComponentProps<typeof FocusCardReviewSession>["copy"];
  emptyMessage: string;
  errorFallback: string;
}>) {
  const [cards, setCards] = useState<SessionSourceCard[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    setError("");

    getCardSession({ patternCode: code, scope: "all" }, controller.signal)
      .then((session) => {
        sessionIdRef.current = session.sessionId;
        setCards(session.cards);
        setLoadState(session.cards.length > 0 ? "loaded" : "empty");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof ApiError ? e.message : errorFallback);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [code, errorFallback]);

  const persistRating = useCallback((cardId: string, rating: ReviewRating, reviewedAt: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    rateCard(cardId, { sessionId, rating, reviewedAt }).catch(() => {
      // Non-blocking: the local queue has already advanced.
    });
  }, []);

  if (loadState === "loading") {
    return <main className="focus-session focus-session--loading">{copy.loading}</main>;
  }

  if (loadState === "empty") {
    return <main className="focus-session focus-session--loading">{emptyMessage}</main>;
  }

  if (loadState === "error") {
    return <main className="focus-session focus-session--loading">{error || errorFallback}</main>;
  }

  return <FocusCardReviewSession brand={brand} cards={toReviewCards(cards)} copy={copy} onRate={persistRating} />;
}
