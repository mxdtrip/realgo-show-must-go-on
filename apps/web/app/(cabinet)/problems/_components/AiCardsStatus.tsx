"use client";

import { useProblemCardsStatus } from "../../../_api/problemCards";

type AiCardsStatusCopy = Readonly<{
  generating: string;
  ready: string;
  none: string;
}>;

/**
 * Card-generation status for one problem (issue #228). Renders nothing while
 * idle or when the endpoint is unavailable (backend not deployed yet), so it
 * is safe to mount unconditionally wherever a real problemId is known.
 */
export function AiCardsStatus({
  problemId,
  copy,
}: Readonly<{ problemId: number | null; copy: AiCardsStatusCopy }>) {
  const state = useProblemCardsStatus(problemId);

  if (state.phase === "idle" || state.phase === "unavailable") return null;

  if (state.phase === "polling" || state.status === "generating") {
    return (
      <span className="ai-cards-status ai-cards-status--generating" role="status">
        <i className="ai-cards-status__spinner" aria-hidden="true" />
        {copy.generating}
      </span>
    );
  }

  if (state.status === "ready") {
    return (
      <span className="ai-cards-status ai-cards-status--ready" role="status">
        {copy.ready} · {state.cards.length}
      </span>
    );
  }

  return <span className="ai-cards-status">{copy.none}</span>;
}
