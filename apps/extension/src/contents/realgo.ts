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
  SubmissionDetectedResponse,
  SubmissionPayload,
  SubmitResult,
} from "../lib/types";
import { AssistantApp } from "../assistant/AssistantApp";
import { streamAssistantHintViaBackground } from "../lib/assistantClient";
import { fetchCardsViaBackground } from "../lib/cardsClient";
import {
  clearCrossPageSubmitIntent,
  getCrossPageSubmitIntent,
  getReviewUrl,
  setCrossPageSubmitIntent,
} from "../lib/storage";
import { adapters, detectAdapter, type PlatformAdapter, type TaskInfo } from "../platforms";
import { looksLikeSubmitLabel } from "../platforms/types";
import { PopupApp } from "../popup/PopupApp";

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.hackerrank.com/*",
    "https://hackerrank.com/*",
    "https://leetcode.com/*",
    "https://www.geeksforgeeks.org/*",
    "https://geeksforgeeks.org/*",
    "https://codeforces.com/*",
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
// Cross-page judging (Codeforces) resumes on a freshly loaded status page, so
// there's no click-to-submit latency to subtract, but the judge itself can
// legitimately take longer than any same-page platform's in-browser run.
const CROSS_PAGE_RESULT_TIMEOUT_MS = 90_000;
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
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshAssistant();
  });
  void resumeCrossPageWatch();
}

/**
 * Landing on a page after a cross-page submit navigated away from the
 * problem (see PlatformAdapter.crossPage): if a pending snapshot for a
 * matching platform is still fresh, pick up watching for a verdict here
 * instead of waiting for a click that will never come on this page.
 */
async function resumeCrossPageWatch(): Promise<void> {
  const adapter = adapters.find((a) => a.crossPage?.isResultPage(location.href));
  if (!adapter) return;
  const pending = await getCrossPageSubmitIntent(adapter.platform);
  await clearCrossPageSubmitIntent(adapter.platform);
  if (!pending) return;
  // The verdict may already be sitting in the DOM before any mutation is
  // observed (judging can finish before this page finishes loading), and
  // cross-page judging can legitimately run longer than the same-page
  // timeout — poll immediately and allow more time.
  watchForResult(adapter, pending, { timeoutMs: CROSS_PAGE_RESULT_TIMEOUT_MS, pollImmediately: true });
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
  const clickInfo = adapter.extractTaskInfo();

  if (adapter.crossPage) {
    // The click is about to navigate away from this page entirely (e.g.
    // Codeforces' Submit link opens a separate form) — a MutationObserver set
    // up here would never fire. Persist the snapshot instead; the page this
    // navigation lands on resumes watching via resumeCrossPageWatch().
    if (clickInfo) void setCrossPageSubmitIntent(adapter.platform, clickInfo);
    return;
  }

  watchForResult(adapter, clickInfo);
}

function isSubmitClick(target: HTMLElement, adapter: PlatformAdapter): boolean {
  const submitButton = adapter.findSubmitButton();
  if (submitButton && (submitButton === target || submitButton.contains(target))) {
    return true;
  }
  // Fallback: the clicked element (or its button ancestor) reads like a
  // submit control. Unbounded startsWith("submit") used to also match
  // unrelated buttons elsewhere on the page ("Submit application" on a
  // HackerRank jobs widget, "Submit feedback", etc.) — this search isn't
  // scoped to the code editor, so the text itself is the only signal.
  const button = target.closest("button, [role='button']") as HTMLElement | null;
  const text = (button?.textContent ?? "").trim().toLowerCase();
  return looksLikeSubmitLabel(text);
}

let watching = false;

function watchForResult(
  adapter: PlatformAdapter,
  clickInfo: TaskInfo | null,
  options: { timeoutMs?: number; pollImmediately?: boolean } = {}
) {
  if (watching) return;
  watching = true;

  const timeoutMs = options.timeoutMs ?? RESULT_TIMEOUT_MS;
  const startedAt = Date.now();
  // pollImmediately: a resumed cross-page watch may land on a page whose
  // verdict is already settled (judging finished before this page loaded), so
  // it can't rely on a future mutation to trigger the first real read.
  let sawMutation = options.pollImmediately ?? false;
  // A single reading isn't trusted on its own: right after a click, the
  // *previous* submission's verdict panel (e.g. an old "Accepted") can
  // still be sitting in the DOM for a moment before the site clears it for
  // the new run, and the broad `[class*='result']`-style selectors the
  // adapters use can't tell old from new by markup alone. Requiring the
  // same reading to repeat on a later poll — i.e. the DOM has actually
  // settled — filters out that transient/stale state without penalizing a
  // genuine resubmit that happens to land on the same verdict again.
  let lastSeen: SubmitResult | null = null;
  const finish = (result: SubmitResult) => {
    clearInterval(timer);
    observer.disconnect();
    watching = false;
    finalize(adapter, result, clickInfo);
  };

  const check = () => {
    if (!sawMutation) {
      if (Date.now() - startedAt > timeoutMs) finish("unknown");
      return;
    }
    if (Date.now() - startedAt < 800) return;
    const result = adapter.detectSubmitResult();
    if (result !== "unknown" && result === lastSeen) {
      finish(result);
      return;
    }
    lastSeen = result;
    if (Date.now() - startedAt > timeoutMs) finish(result);
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

  // Ask the background worker to try opening the toolbar popup first, and
  // only fall back to the in-page overlay if that didn't happen — showing
  // both at once for the same submission stacks two identical rating cards
  // (one anchored to the page, one in the toolbar) on top of each other.
  Promise.resolve(chrome.runtime.sendMessage({ type: "REALGO_SUBMISSION_DETECTED", submission }))
    .then((response: SubmissionDetectedResponse | undefined) => {
      if (!response?.popupOpened) enqueueOverlay(submission);
    })
    .catch(() => {
      /* background may be asleep; the in-page overlay is the only UI left */
      enqueueOverlay(submission);
    });
}

/* -- In-page fallback overlay (shadow DOM, PopupApp reused) ------------- */

let overlayHost: HTMLDivElement | null = null;
let overlayRoot: Root | null = null;

// Submissions detected while an earlier one is still on screen, unrated. A
// second accepted submit used to call showOverlay() straight away, which
// unmounts whatever's showing first — if the user hadn't picked a
// difficulty yet, that submission was never sent to REALGO_SAVE_SUBMISSION
// and its review card silently never got created. Queuing instead means
// nothing gets replaced until the user actually disposes of the current one
// (saves it or dismisses it).
const overlayQueue: DetectedSubmission[] = [];

function enqueueOverlay(submission: DetectedSubmission) {
  overlayQueue.push(submission);
  if (!overlayRoot) showNextQueuedOverlay();
}

function showNextQueuedOverlay() {
  const next = overlayQueue.shift();
  if (next) showOverlay(next);
}

/** Dismisses the current overlay (saved, collapsed, or closed) and, unlike a
    bare removeOverlay(), advances to the next queued submission if any. */
function dismissOverlay() {
  removeOverlay();
  showNextQueuedOverlay();
}

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
      // "Свернуть": dismiss this one and reveal the next queued submission,
      // if any, instead of just hiding until the next fresh solve.
      onClose: dismissOverlay,
      // "К повторению": open the web app's review cards in a new tab.
      onReview: openReview,
    })
  );
}

/** Opens the realgo review cards section in a new browser tab. */
async function openReview() {
  const url = await getReviewUrl();
  window.open(url, "_blank", "noopener,noreferrer");
  dismissOverlay();
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
let assistantUrl = "";

function refreshAssistant() {
  if (document.hidden) return;
  // The one-second timer remains a robust fallback for SPA navigation, but a
  // stable mounted task now avoids all adapter/DOM extraction work.
  if (location.href === assistantUrl && assistantHost?.isConnected) return;

  const task = currentAssistantTaskResponse().task ?? null;
  if (!task) {
    removeAssistant();
    return;
  }

  const key = `${task.platform}:${task.platformTaskSlug}:${task.taskUrl}`;
  if (key === assistantKey && assistantHost?.isConnected) {
    assistantUrl = location.href;
    return;
  }

  removeAssistant();
  assistantKey = key;
  assistantUrl = location.href;
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
      onAsk: streamAssistantHintViaBackground,
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
  assistantUrl = "";
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
  return (
    platform === "leetcode" ||
    platform === "hackerrank" ||
    platform === "geeksforgeeks" ||
    platform === "codeforces"
  );
}

init();
