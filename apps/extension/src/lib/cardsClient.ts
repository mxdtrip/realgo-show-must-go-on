import type { CardsResponse, ProblemCardsResult } from "./types";

/**
 * Cards readiness via the background worker — the UI-side counterpart of the
 * REALGO_GET_PROBLEM_CARDS handler. Shared by the in-page overlay and the
 * toolbar popup so both feed the same fetcher into PopupApp.
 *
 * Mirrors the transport's "never throw" rule: any failure (asleep worker,
 * closed channel, unavailable endpoint) resolves to `null`, which the popup
 * renders as "no cards block at all".
 */
export async function fetchCardsViaBackground(
  problemId: number
): Promise<ProblemCardsResult | null> {
  try {
    const res: CardsResponse | undefined = await chrome.runtime.sendMessage({
      type: "REALGO_GET_PROBLEM_CARDS",
      problemId,
    });
    return res?.ok && res.result ? res.result : null;
  } catch {
    return null;
  }
}
