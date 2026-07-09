"use client";

import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../../../_api/types";
import { getCardSession, rateCard, toReviewCards } from "../../../../_api/cards";
import { FocusCardReviewSession } from "../../../../(cabinet)/cards/_components/FocusCardReviewSession";
import type { ReviewCard, ReviewRating } from "../../../../(cabinet)/cards/_state/useCardReviewSession";

type LoadState = "loading" | "api" | "mock" | "error";

export function CardSessionClient({
  brand,
  copy,
  errorFallback,
  mockCards,
}: Readonly<{
  brand: string;
  copy: ComponentProps<typeof FocusCardReviewSession>["copy"];
  errorFallback: string;
  mockCards: readonly ReviewCard[];
}>) {
  const [cards, setCards] = useState<readonly ReviewCard[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getCardSession({ scope: "due" }, controller.signal)
      .then((session) => {
        sessionIdRef.current = session.sessionId;
        setCards(toReviewCards(session.cards));
        // An empty due queue is a valid api answer: FocusCardReviewSession
        // renders its "session complete" screen for zero cards.
        setLoadState("api");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        // Demo mode: unauthenticated visitors (401) and a stopped backend
        // (network, status 0) still get the local mock session, exactly as
        // before the api wiring. Ratings then stay in localStorage only.
        if (e instanceof ApiError && (e.status === 401 || e.status === 0)) {
          setCards(mockCards);
          setLoadState("mock");
          return;
        }
        setError(e instanceof ApiError ? e.message : errorFallback);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [errorFallback, mockCards]);

  const persistRating = useCallback((cardId: string, rating: ReviewRating, reviewedAt: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    rateCard(cardId, { sessionId, rating, reviewedAt }).catch(() => {
      // Non-blocking: the local queue has already advanced; the next session
      // fetch reflects whatever the server last accepted.
    });
  }, []);

  if (loadState === "loading") {
    return <main className="focus-session focus-session--loading">{copy.loading}</main>;
  }

  if (loadState === "error") {
    return <main className="focus-session focus-session--loading">{error || errorFallback}</main>;
  }

  return (
    <FocusCardReviewSession
      brand={brand}
      cards={cards}
      copy={copy}
      onRate={loadState === "api" ? persistRating : undefined}
    />
  );
}
