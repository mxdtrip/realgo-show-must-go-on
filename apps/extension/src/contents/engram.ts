import type { PlasmoCSConfig } from "plasmo";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import type {
  DetectedSubmission,
  SaveResponse,
  SubmissionPayload,
  SubmitResult,
} from "../lib/types";
import { detectAdapter, type PlatformAdapter } from "../platforms";
import { PopupApp } from "../popup/PopupApp";

export const config: PlasmoCSConfig = {
  matches: [
    "https://neetcode.io/*",
    "https://*.neetcode.io/*",
    "https://leetcode.com/*",
  ],
  run_at: "document_idle",
};

/**
 * Content script. Watches the page for a Submit, resolves the verdict and then
 * (a) notifies the background worker and (b) shows an in-page fallback overlay
 * with the rating form. All DOM access is defensive — it must never break the
 * host page.
 */
const RESULT_POLL_MS = 500;
const RESULT_TIMEOUT_MS = 20_000;

function init() {
  const adapter = detectAdapter(location.href);
  if (!adapter) return;

  // Capture-phase delegation survives the SPA re-rendering its buttons.
  document.addEventListener("click", (event) => onDocumentClick(event, adapter), true);
}

function onDocumentClick(event: MouseEvent, adapter: PlatformAdapter) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (!isSubmitClick(target, adapter)) return;
  watchForResult(adapter);
}

function isSubmitClick(target: HTMLElement, adapter: PlatformAdapter): boolean {
  const submitButton = adapter.findSubmitButton();
  if (submitButton && (submitButton === target || submitButton.contains(target))) {
    return true;
  }
  // Fallback: the clicked element (or its button ancestor) reads "submit".
  const button = target.closest("button, [role='button']") as HTMLElement | null;
  const text = (button?.textContent ?? "").trim().toLowerCase();
  return text === "submit" || text.startsWith("submit");
}

let watching = false;

function watchForResult(adapter: PlatformAdapter) {
  if (watching) return;
  watching = true;

  const startedAt = Date.now();
  const finish = (result: SubmitResult) => {
    clearInterval(timer);
    observer.disconnect();
    watching = false;
    finalize(adapter, result);
  };

  const check = () => {
    const result = adapter.detectSubmitResult();
    if (result !== "unknown") {
      finish(result);
    } else if (Date.now() - startedAt > RESULT_TIMEOUT_MS) {
      finish("unknown");
    }
  };

  const observer = new MutationObserver(check);
  try {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch {
    /* body may not be ready; the interval still drives detection */
  }
  const timer = setInterval(check, RESULT_POLL_MS);
}

let lastKey = "";

/** Stable idempotency id for one submit. Falls back when randomUUID is absent. */
function newEventId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through to the manual id below */
  }
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function finalize(adapter: PlatformAdapter, submitResult: SubmitResult) {
  const info = adapter.extractTaskInfo();
  if (!info) return;

  const submission: DetectedSubmission = {
    // One id per detected submit. The dedupe below stops the same task firing
    // twice in a page session, so this id stays stable for retries (overlay or
    // toolbar popup) and the backend treats re-sends as idempotent.
    eventId: newEventId(),
    platform: adapter.platform,
    taskTitle: info.taskTitle,
    taskUrl: info.taskUrl,
    platformTaskSlug: info.platformTaskSlug,
    submitResult,
    submittedAt: new Date().toISOString(),
  };

  // Dedupe rapid double submits of the same task within one page session.
  const key = `${submission.platformTaskSlug}|${submission.taskUrl}`;
  if (key === lastKey) return;
  lastKey = key;

  try {
    chrome.runtime.sendMessage({ type: "ENGRAM_SUBMISSION_DETECTED", submission });
  } catch {
    /* background may be asleep; overlay still works */
  }

  showOverlay(submission);
}

/* -- In-page fallback overlay (shadow DOM, PopupApp reused) ------------- */

let overlayHost: HTMLDivElement | null = null;
let overlayRoot: Root | null = null;

function removeOverlay() {
  overlayRoot?.unmount();
  overlayHost?.remove();
  overlayRoot = null;
  overlayHost = null;
}

function showOverlay(submission: DetectedSubmission) {
  removeOverlay();

  overlayHost = document.createElement("div");
  overlayHost.id = "engram-overlay-host";
  const shadow = overlayHost.attachShadow({ mode: "open" });
  const mount = document.createElement("div");
  mount.className = "engram-overlay";

  const closeBtn = document.createElement("button");
  closeBtn.className = "engram-overlay-close";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Закрыть");
  closeBtn.addEventListener("click", removeOverlay);

  mount.appendChild(closeBtn);
  shadow.appendChild(mount);
  document.body.appendChild(overlayHost);

  overlayRoot = createRoot(mount);
  overlayRoot.render(
    createElement(PopupApp, {
      submission,
      onSave: saveViaBackground,
      onClose: removeOverlay,
    })
  );
}

/** Routes the save through the background worker to dodge host-page CORS. */
async function saveViaBackground(payload: SubmissionPayload): Promise<void> {
  const res: SaveResponse | undefined = await chrome.runtime.sendMessage({
    type: "ENGRAM_SAVE_SUBMISSION",
    payload,
  });
  if (!res?.ok) {
    throw new Error(res?.error ?? "Не удалось сохранить.");
  }
}

init();
