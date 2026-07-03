"use client";

import type { ComponentProps } from "react";
import { useEffect, useState } from "react";

import { ApiError } from "../../../../../_api/types";
import { getCardSession, toReviewCards, type SessionSourceCard } from "../../../../../_api/cards";
import { FocusCardReviewSession } from "../../../../../(cabinet)/cards/_components/FocusCardReviewSession";

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

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    setError("");

    getCardSession({ patternCode: code, scope: "all" }, controller.signal)
      .then((session) => {
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

  if (loadState === "loading") {
    return <main className="focus-session focus-session--loading">{copy.loading}</main>;
  }

  if (loadState === "empty") {
    return <main className="focus-session focus-session--loading">{emptyMessage}</main>;
  }

  if (loadState === "error") {
    return <main className="focus-session focus-session--loading">{error || errorFallback}</main>;
  }

  return <FocusCardReviewSession brand={brand} cards={toReviewCards(cards)} copy={copy} />;
}
