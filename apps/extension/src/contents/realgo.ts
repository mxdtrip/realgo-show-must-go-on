import type { PlasmoCSConfig } from "plasmo";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import type {
  AssistantTask,
  CurrentTaskResponse,
  DetectedSubmission,
  ExtensionEventResult,
  RuntimeMessage,
  SaveResponse,
  SubmissionPayload,
  SubmitResult,
} from "../lib/types";
import { AssistantApp } from "../assistant/AssistantApp";
import { fetchAssistantHintViaBackground } from "../lib/assistantClient";
import { fetchCardsViaBackground } from "../lib/cardsClient";
import { getReviewUrl } from "../lib/storage";
import { detectAdapter, type PlatformAdapter, type TaskInfo } from "../platforms";
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
const ASSISTANT_REFRESH_MS = 1_000;

function init() {
  // The manifest already scopes this script to supported hosts, so the listener
  // is attached unconditionally and the adapter is resolved per click. Resolving
  // it once at load broke SPA flows: landing on a list page (e.g. /practice)
  // yields no adapter, and the client-side hop to /problems/<slug> never
  // re-runs init — the extension stayed inert until a hard reload.
  // Capture-phase delegation survives the SPA re-rendering its buttons.
  document.addEventListener("click", onDocumentClick, true);
  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  refreshAssistant();
  window.setInterval(refreshAssistant, ASSISTANT_REFRESH_MS);
}

function onRuntimeMessage(
  message: RuntimeMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: CurrentTaskResponse) => void
) {
  if (message.type !== "REALGO_GET_CURRENT_TASK") return false;
  sendResponse(currentAssistantTaskResponse());
  return false;
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const adapter = detectAdapter(location.href);
  if (!adapter) return;
  if (!isSubmitClick(target, adapter)) return;
  // Snapshot the task while still on the problem page: after a submit the SPA
  // can swap to the submission-history URL, where extraction would fail.
  watchForResult(adapter, adapter.extractTaskInfo());
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

function watchForResult(adapter: PlatformAdapter, clickInfo: TaskInfo | null) {
  if (watching) return;
  watching = true;

  const startedAt = Date.now();
  let sawMutation = false;
  const finish = (result: SubmitResult) => {
    clearInterval(timer);
    observer.disconnect();
    watching = false;
    finalize(adapter, result, clickInfo);
  };

  const check = () => {
    if (!sawMutation) {
      if (Date.now() - startedAt > RESULT_TIMEOUT_MS) finish("unknown");
      return;
    }
    if (Date.now() - startedAt < 800) return;
    const result = adapter.detectSubmitResult();
    if (result !== "unknown") {
      finish(result);
    } else if (Date.now() - startedAt > RESULT_TIMEOUT_MS) {
      finish("unknown");
    }
  };

  const observer = new MutationObserver(() => {
    sawMutation = true;
    check();
  });
  try {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch {
    /* body may not be ready; the interval still drives detection */
  }
  const timer = setInterval(check, RESULT_POLL_MS);
}

let lastKey = "";
let lastKeyAt = 0;
/** Duplicate notifications of one submit land within this window. */
const DEDUPE_WINDOW_MS = 3_000;

/** Stable idempotency id for one submit. Falls back when randomUUID is absent. */
function newEventId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through to the manual id below */
  }
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function finalize(
  adapter: PlatformAdapter,
  submitResult: SubmitResult,
  clickInfo: TaskInfo | null
) {
  // Prefer the click-time snapshot; by verdict time the SPA may already sit on
  // a URL (submission history) the adapter cannot extract a task from.
  const info = clickInfo ?? adapter.extractTaskInfo();
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
    tags: info.tags,
    difficulty: info.difficulty,
    submitResult,
    submittedAt: new Date().toISOString(),
  };

  // Dedupe duplicate click/mutation notifications, not genuine later submits:
  // the window is short and the key includes the verdict, so a fail → fix →
  // resubmit sequence of one task still fires each time.
  const key = `${submission.platformTaskSlug}|${submission.taskUrl}|${submitResult}`;
  const now = Date.now();
  if (key === lastKey && now - lastKeyAt < DEDUPE_WINDOW_MS) return;
  lastKey = key;
  lastKeyAt = now;

  // The popup is a spaced-repetition rating flow and must only appear after a
  // confirmed accepted verdict. Wrong answers, runtime errors and verdict
  // timeouts are not solved tasks and must never create review schedules.
  if (submitResult !== "accepted") return;

  try {
    chrome.runtime.sendMessage({ type: "REALGO_SUBMISSION_DETECTED", submission });
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
  overlayHost.id = "realgo-overlay-host";
  // `all: initial` walls the host off from the page's global CSS (e.g. a
  // framework reset that would otherwise paint a border/background frame around
  // the card). Positioning lives here too; the shadow content stays static.
  // Placed below the site's top nav so a self-triggered popup doesn't cover it.
  overlayHost.style.cssText =
    "all: initial; position: fixed; top: 76px; right: 16px; z-index: 2147483647; color-scheme: dark; background: transparent; width: max-content; height: max-content;";
  const shadow = overlayHost.attachShadow({ mode: "open" });
  const mount = document.createElement("div");
  mount.className = "realgo-overlay";
  mount.style.cssText = "all: initial; display: block; background: transparent; width: max-content; height: max-content;";

  // The close affordance lives in the popup header (PopupApp renders an X when
  // given onClose), so the overlay doesn't add its own button.
  shadow.appendChild(mount);
  document.body.appendChild(overlayHost);

  overlayRoot = createRoot(mount);
  overlayRoot.render(
    createElement(PopupApp, {
      submission,
      onSave: saveViaBackground,
      // Cards readiness poll ticks, routed through the background worker.
      onFetchCards: fetchCardsViaBackground,
      // "Свернуть": hide until the next solved task (overlay re-renders on submit).
      onClose: removeOverlay,
      // "К повторению": open the web app's review cards in a new tab.
      onReview: openReview,
    })
  );
}

/** Opens the realgo review cards section in a new browser tab. */
async function openReview() {
  const url = await getReviewUrl();
  window.open(url, "_blank", "noopener,noreferrer");
  removeOverlay();
}

/**
 * Routes the save through the background worker to dodge host-page CORS.
 * Resolves with the backend's event result so the popup can start the cards
 * poll off its `problemId` (null when the backend didn't provide one).
 */
async function saveViaBackground(
  payload: SubmissionPayload
): Promise<ExtensionEventResult | null> {
  const res: SaveResponse | undefined = await chrome.runtime.sendMessage({
    type: "REALGO_SAVE_SUBMISSION",
    payload,
  });
  if (!res?.ok) {
    throw new Error(res?.error ?? "Не удалось сохранить.");
  }
  return res.result ?? null;
}

/* -- In-page AI assistant (shadow DOM, independent from submit overlay) ----- */

let assistantHost: HTMLDivElement | null = null;
let assistantRoot: Root | null = null;
let assistantKey = "";

function refreshAssistant() {
  const task = currentAssistantTaskResponse().task ?? null;
  if (!task) {
    removeAssistant();
    return;
  }

  const key = `${task.platform}:${task.platformTaskSlug}:${task.taskUrl}`;
  if (key === assistantKey && assistantHost?.isConnected) return;

  removeAssistant();
  assistantKey = key;
  assistantHost = document.createElement("div");
  assistantHost.id = "realgo-assistant-host";
  assistantHost.style.cssText =
    "all: initial; position: fixed; right: 16px; bottom: 18px; z-index: 2147483646; color-scheme: dark; background: transparent; width: max-content; height: max-content; pointer-events: none;";
  const shadow = assistantHost.attachShadow({ mode: "open" });
  const mount = document.createElement("div");
  mount.className = "realgo-assistant-root";
  mount.style.cssText = "all: initial; display: block; background: transparent; width: max-content; height: max-content; pointer-events: none;";
  shadow.appendChild(mount);
  document.body.appendChild(assistantHost);

  assistantRoot = createRoot(mount);
  assistantRoot.render(
    createElement(AssistantApp, {
      task,
      onAsk: fetchAssistantHintViaBackground,
    })
  );
}

function currentAssistantTaskResponse(): CurrentTaskResponse {
  const adapter = detectAdapter(location.href);
  const info = adapter?.extractTaskInfo() ?? null;
  const task = adapter && info ? assistantTaskFrom(adapter, info) : null;
  return task ? { ok: true, task } : { ok: false };
}

function removeAssistant() {
  assistantRoot?.unmount();
  assistantHost?.remove();
  assistantRoot = null;
  assistantHost = null;
  assistantKey = "";
}

function assistantTaskFrom(adapter: PlatformAdapter, info: TaskInfo): AssistantTask | null {
  if (!isAssistantPlatform(adapter.platform)) return null;
  const slug = info.platformTaskSlug?.trim();
  if (!slug) return null;
  return {
    platform: adapter.platform,
    taskTitle: info.taskTitle,
    taskUrl: info.taskUrl,
    platformTaskSlug: slug,
    tags: info.tags,
    difficulty: info.difficulty,
    taskDescription: info.taskDescription,
  };
}

function isAssistantPlatform(platform: PlatformAdapter["platform"]): platform is AssistantTask["platform"] {
  return platform === "leetcode" || platform === "neetcode";
}

init();
