import { useEffect, useState } from "react";

import type { ProblemCardsResult } from "../lib/types";

/** What the success screen shows about the task's review cards. */
export type CardsUiState = "hidden" | "generating" | "ready" | "none";

const POLL_INTERVAL_MS = 2_500;
const POLL_DEADLINE_MS = 60_000;
/** Consecutive unusable answers tolerated before the block goes away. */
const MAX_CONSECUTIVE_FAILURES = 2;

/**
 * Polls the cards readiness of a problem after a successful save and reduces
 * the answers to one UI state.
 *
 * Silent by design: the state starts (and on any doubt stays) "hidden", so a
 * missing `problemId`, an absent fetcher or an endpoint that hasn't shipped
 * yet (404 today) leave the popup pixel-identical to the pre-feature one.
 * Nothing is shown until the backend actually says something useful — the
 * feature switches itself on when the route appears.
 *
 * Quirks encoded here:
 * - "none" on the first tick is provisional: the async generation may not
 *   have taken its lock yet, so it gets one more look before the calm
 *   "no cards" stub is shown.
 * - a lone mid-poll failure is forgiven (worker restart, blip); only
 *   MAX_CONSECUTIVE_FAILURES in a row hide the block.
 * - the deadline turns a still-running generation into the same calm stub,
 *   never into an error — unless the block was hidden anyway.
 */
export function useProblemCards(
  problemId: number | null,
  fetchCards?: (problemId: number) => Promise<ProblemCardsResult | null>
): CardsUiState {
  const [state, setState] = useState<CardsUiState>("hidden");

  useEffect(() => {
    if (problemId == null || !fetchCards) return;

    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();
    let failures = 0;
    let ticks = 0;

    const finish = (s: CardsUiState) => {
      if (!cancelled) setState(s);
    };

    const tick = async () => {
      ticks += 1;
      const result = await fetchCards(problemId).catch(() => null);
      if (cancelled) return;

      if (result == null) {
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          finish("hidden");
          return;
        }
      } else {
        failures = 0;
        if (result.status === "ready") {
          finish("ready");
          return;
        }
        if (result.status === "none" && ticks > 1) {
          finish("none");
          return;
        }
        if (result.status === "generating") {
          finish("generating");
        }
        // Provisional first-tick "none": stay as we are, poll again.
      }

      if (Date.now() - startedAt >= POLL_DEADLINE_MS) {
        // Cap reached mid-generation → the calm stub; if nothing was ever
        // shown, don't let a stub pop out of nowhere a minute later.
        setState((current) => (cancelled || current === "hidden" ? current : "none"));
        return;
      }
      timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [problemId, fetchCards]);

  return state;
}
