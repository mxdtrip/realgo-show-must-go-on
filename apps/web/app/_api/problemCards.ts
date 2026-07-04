"use client";

import { useEffect, useRef, useState } from "react";

import { apiFetch } from "./client";

// Client for GET /me/problems/{id}/cards (contract: issue #227). The backend
// endpoint ships later (#222/#227); until then every request 404s and the
// hook resolves to "unavailable" so callers can render nothing — the feature
// lights up by itself once the API lands.

export type ProblemCardsStatus = "ready" | "generating" | "none";

export type ProblemCard = {
  id: number;
  type: string;
  front: string;
  back: string;
  createdByAi?: boolean;
};

export type ProblemCardsResponse = {
  status: ProblemCardsStatus;
  cards: ProblemCard[];
};

export function getProblemCards(problemId: number, signal?: AbortSignal) {
  return apiFetch<ProblemCardsResponse>(`/me/problems/${problemId}/cards`, { signal });
}

/** Hook state: contract statuses plus the client-side phases. */
export type ProblemCardsPollState =
  | { phase: "idle" }
  | { phase: "polling" }
  | { phase: "unavailable" }
  | { phase: "settled"; status: ProblemCardsStatus; cards: ProblemCard[] };

const POLL_INTERVAL_MS = 2500;
const POLL_CAP_MS = 60_000;

/**
 * Polls the card status for a problem every 2.5s for up to 60s, stopping
 * early on "ready" or "none". Any error (404 while the endpoint does not
 * exist yet, network failure, auth hiccup) quietly ends the poll as
 * "unavailable" — callers must treat that as "render nothing".
 */
export function useProblemCardsStatus(problemId: number | null): ProblemCardsPollState {
  const [state, setState] = useState<ProblemCardsPollState>({ phase: "idle" });
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (problemId === null) {
      setState({ phase: "idle" });
      return;
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    startedAtRef.current = Date.now();
    setState({ phase: "polling" });

    const tick = async () => {
      let response: ProblemCardsResponse;
      try {
        response = await getProblemCards(problemId, controller.signal);
      } catch {
        if (!controller.signal.aborted) setState({ phase: "unavailable" });
        return;
      }
      if (controller.signal.aborted) return;

      if (response.status !== "generating") {
        setState({ phase: "settled", status: response.status, cards: response.cards ?? [] });
        return;
      }
      if (Date.now() - startedAtRef.current >= POLL_CAP_MS) {
        // Generation is taking too long for an interactive wait; show the
        // neutral empty state, the cards will simply be there next visit.
        setState({ phase: "settled", status: "none", cards: [] });
        return;
      }
      setState({ phase: "settled", status: "generating", cards: [] });
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    void tick();

    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [problemId]);

  return state;
}
