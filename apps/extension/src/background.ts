import { saveSubmission } from "./lib/api";
import { setLastSubmission } from "./lib/storage";
import type { DetectedSubmission, RuntimeMessage } from "./lib/types";

/**
 * Background service worker.
 *
 * Receives submission events from the content script, persists the latest one,
 * badges the toolbar icon and makes a best-effort attempt to open the popup.
 * Programmatic popup opening is unreliable across Chrome versions, so the
 * content script also renders an in-page fallback overlay.
 */
chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === "ENGRAM_SUBMISSION_DETECTED") {
      handleDetected(message.submission)
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true; // keep the message channel open for the async response
    }

    if (message.type === "ENGRAM_SAVE_SUBMISSION") {
      // Proxy saves from the in-page overlay through the background worker: it
      // runs on the extension origin with host_permissions, so the request is
      // not subject to the host page's CORS policy.
      saveSubmission(message.payload)
        .then(() => sendResponse({ ok: true }))
        .catch((e) =>
          sendResponse({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          })
        );
      return true;
    }

    return false;
  }
);

async function handleDetected(submission: DetectedSubmission): Promise<void> {
  await setLastSubmission(submission);

  try {
    await chrome.action.setBadgeText({ text: "1" });
    await chrome.action.setBadgeBackgroundColor({ color: "#2f81f7" });
  } catch {
    /* badge is cosmetic */
  }

  try {
    // Chrome 127+ only, and only within a user gesture window — may throw.
    await chrome.action.openPopup();
  } catch {
    /* expected on most versions; the in-page overlay is the fallback */
  }
}
