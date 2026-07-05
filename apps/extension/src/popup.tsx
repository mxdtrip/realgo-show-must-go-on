import { useEffect, useState } from "react";

import { fetchCardsViaBackground } from "./lib/cardsClient";
import { clearLastSubmission, getLastSubmission, getReviewUrl } from "./lib/storage";
import type {
  DetectedSubmission,
  ExtensionEventResult,
  SaveResponse,
  SubmissionPayload,
} from "./lib/types";
import { PopupApp } from "./popup/PopupApp";

/**
 * Toolbar popup entry. Shows the most recently detected submission (stored by
 * the background worker), so clicking the realgo icon after a submit always
 * works even when the popup could not be opened programmatically.
 */
function IndexPopup() {
  const [submission, setSubmission] = useState<
    DetectedSubmission | null | undefined
  >(undefined);

  useEffect(() => {
    getLastSubmission()
      .then((s) => setSubmission(s ?? null))
      .catch(() => setSubmission(null));
  }, []);

  async function handleSave(
    payload: SubmissionPayload
  ): Promise<ExtensionEventResult | null> {
    // Route the save through the background worker (same path as the in-page
    // overlay) so transport/business logic lives in one place (#35, #38).
    const res: SaveResponse | undefined = await chrome.runtime.sendMessage({
      type: "REALGO_SAVE_SUBMISSION",
      payload,
    });
    if (!res?.ok) {
      throw new Error(res?.error ?? "Не удалось сохранить.");
    }
    await clearLastSubmission();
    try {
      await chrome.action.setBadgeText({ text: "" });
    } catch {
      /* action API may be unavailable in some contexts */
    }
    // The event result carries problemId — the popup polls cards off it.
    return res.result ?? null;
  }

  async function handleReview() {
    // Open the web app's review cards in a new tab, then close the popup.
    const url = await getReviewUrl();
    try {
      await chrome.tabs.create({ url });
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    window.close();
  }

  return (
    <PopupApp
      submission={submission}
      onSave={handleSave}
      onFetchCards={fetchCardsViaBackground}
      onCollapse={() => window.close()}
      onReview={handleReview}
    />
  );
}

export default IndexPopup;
