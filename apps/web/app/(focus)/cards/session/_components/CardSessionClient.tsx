"use client";

import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "../../../../_api/types";
import { getCardSession, rateCard, toReviewCards, type SessionScope } from "../../../../_api/cards";
import { FocusCardReviewSession } from "../../../../(cabinet)/cards/_components/FocusCardReviewSession";
import type { ReviewCard, ReviewRating } from "../../../../(cabinet)/cards/_state/useCardReviewSession";

type LoadState = "loading" | "loaded" | "error";

export function CardSessionClient({
  brand,
  copy,
  errorFallback,
  retryLabel,
  scope = "due",
}: Readonly<{
  brand: string;
  copy: ComponentProps<typeof FocusCardReviewSession>["copy"];
  errorFallback: string;
  retryLabel: string;
  /** due — обычное повторение; practice — все карточки активных подпаттернов. */
  scope?: SessionScope;
}>) {
  const [cards, setCards] = useState<readonly ReviewCard[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const sessionIdRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    setError("");

    getCardSession({ scope }, controller.signal)
      .then((session) => {
        sessionIdRef.current = session.sessionId;
        setCards(toReviewCards(session.cards));
        // An empty due queue is a valid api answer: FocusCardReviewSession
        // renders its "session complete" screen for zero cards.
        setLoadState("loaded");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setError(e instanceof ApiError && e.message ? e.message : errorFallback);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [errorFallback, router, scope, reloadVersion]);

  const persistRating = useCallback(async (cardId: string, rating: ReviewRating, reviewedAt: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) throw new Error("card session is not initialized");
    await rateCard(cardId, { sessionId, rating, reviewedAt });
  }, []);

  if (loadState === "loading") {
    return <main className="focus-session focus-session--loading">{copy.loading}</main>;
  }

  if (loadState === "error") {
    return (
      <main className="focus-session focus-session--loading">
        <div role="alert">
          <p>{error || errorFallback}</p>
          <button
            className="review-action review-action--ghost"
            type="button"
            onClick={() => setReloadVersion((version) => version + 1)}
          >
            {retryLabel}
          </button>
        </div>
      </main>
    );
  }

  return (
    <FocusCardReviewSession brand={brand} cards={cards} copy={copy} onRate={persistRating} />
  );
}
