import { ApiError, getAssistantHint, getProblemCards, saveSubmission } from "./lib/api";
import { clearLastSubmission, setLastSubmission } from "./lib/storage";
import type {
  CardsResponse,
  DetectedSubmission,
  RuntimeMessage,
  AssistantHintResponse,
  SaveResponse,
} from "./lib/types";

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
    if (message.type === "REALGO_SUBMISSION_DETECTED") {
      handleDetected(message.submission)
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true; // keep the message channel open for the async response
    }

    if (message.type === "REALGO_SAVE_SUBMISSION") {
      // Single transport entry point: both the in-page overlay AND the toolbar
      // popup save through here. The background worker runs on the extension
      // origin with host_permissions, so the request dodges the host page's CORS
      // policy — and the UI never duplicates network/business logic (#35, #38).
      saveSubmission(message.payload)
        .then(async (result) => {
          // Saved successfully: drop the pending submission and clear the badge
          // so the extension doesn't keep showing a stale "1" pending state.
          await clearLastSubmission();
          try {
            await chrome.action.setBadgeText({ text: "" });
          } catch {
            /* badge is cosmetic */
          }
          sendResponse({ ok: true, result } satisfies SaveResponse);
        })
        .catch((e) => sendResponse(toErrorResponse(e)))
        .catch(() => {
          /* sendResponse can throw if the channel closed; nothing to do */
        });
      return true;
    }

    if (message.type === "REALGO_GET_PROBLEM_CARDS") {
      // One poll tick of the cards readiness. Same CORS rationale as the save:
      // only the background worker can talk to the API from an overlay context.
      // getProblemCards never throws — `ok: false` simply means "no usable
      // answer" and the UI stays silent (the endpoint may not exist yet).
      getProblemCards(message.problemId)
        .then((result) =>
          sendResponse(
            (result ? { ok: true, result } : { ok: false }) satisfies CardsResponse
          )
        )
        .catch(() => {
          /* sendResponse can throw if the channel closed; nothing to do */
        });
      return true;
    }

    if (message.type === "REALGO_GET_ASSISTANT_HINT") {
      getAssistantHint(message.payload)
        .then((result) =>
          sendResponse({ ok: true, result } satisfies AssistantHintResponse)
        )
        .catch((e) => sendResponse(toAssistantErrorResponse(e)))
        .catch(() => {
          /* sendResponse can throw if the channel closed; nothing to do */
        });
      return true;
    }

    return false;
  }
);

/** Normalises any thrown error into the UI's SaveResponse shape. */
function toErrorResponse(e: unknown): SaveResponse {
  if (e instanceof ApiError) {
    return { ok: false, error: e.message, code: e.code ?? String(e.status) };
  }
  return {
    ok: false,
    error: e instanceof Error ? e.message : String(e),
    code: "unknown",
  };
}

function toAssistantErrorResponse(e: unknown): AssistantHintResponse {
  if (e instanceof ApiError) {
    return { ok: false, error: e.message, code: e.code ?? String(e.status) };
  }
  return {
    ok: false,
    error: e instanceof Error ? e.message : String(e),
    code: "unknown",
  };
}

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
