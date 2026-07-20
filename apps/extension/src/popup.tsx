import { useEffect, useState } from "react";

import { AssistantApp } from "./assistant/AssistantApp";
import { streamAssistantHintViaBackground } from "./lib/assistantClient";
import { fetchCardsViaBackground } from "./lib/cardsClient";
import { getPendingSubmissions, getReviewUrl, removePendingSubmission } from "./lib/storage";
import type {
  AssistantTask,
  CurrentTaskResponse,
  DetectedSubmission,
  ExtensionEventResult,
  SaveResponse,
  SubmissionPayload,
} from "./lib/types";
import { PopupApp } from "./popup/PopupApp";

const POPUP_DOCUMENT_CSS = `
html, body {
  margin: 0 !important;
  padding: 0 !important;
  background: #0d1117 !important;
  color-scheme: dark;
  overflow: hidden !important;
  border-radius: 8px;
}
body {
  width: max-content;
  min-width: 0;
}
#__plasmo, #plasmo-shadow-container {
  display: block;
  margin: 0 !important;
  padding: 0 !important;
  background: #0d1117 !important;
  border-radius: 8px;
  overflow: hidden;
}
`;

/**
 * Toolbar popup entry. Shows the most recently detected submission (stored by
 * the background worker), so clicking the realgo icon after a submit always
 * works even when the popup could not be opened programmatically.
 */
function IndexPopup() {
  const [submission, setSubmission] = useState<
    DetectedSubmission | null | undefined
  >(undefined);
  const [currentTask, setCurrentTask] = useState<AssistantTask | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getPendingSubmissions().catch(() => []), getCurrentTask()])
      .then(([pending, task]) => {
        if (!alive) return;
        setCurrentTask(task);
        // Prefer whichever pending submission matches the active tab (most
        // relevant to what the user is looking at), but don't require a
        // match: a submission stays in the queue until it's rated, so if
        // the user switched tabs/tasks before rating it, it must still be
        // reachable from the toolbar icon — not just "task not recognised".
        const forCurrentTask = task ? pending.find((item) => matchesTask(item, task)) : undefined;
        setSubmission(forCurrentTask ?? pending[0] ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setCurrentTask(null);
        setSubmission(null);
      });
    return () => {
      alive = false;
    };
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
    await removePendingSubmission(payload.eventId);
    try {
      // Reflect what's actually still pending (other tabs may have their
      // own queued submissions) instead of clearing the badge outright.
      const remaining = (await getPendingSubmissions()).length;
      await chrome.action.setBadgeText({ text: remaining > 0 ? String(remaining) : "" });
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
    <>
      <style>{POPUP_DOCUMENT_CSS}</style>
      {submission ? (
        <PopupApp
          submission={submission}
          onSave={handleSave}
          onFetchCards={fetchCardsViaBackground}
          onCollapse={() => window.close()}
          onReview={handleReview}
        />
      ) : currentTask ? (
        <AssistantApp
          task={currentTask}
          onAsk={streamAssistantHintViaBackground}
          variant="panel"
          onClose={() => window.close()}
        />
      ) : (
        <PopupApp
          submission={submission}
          onSave={handleSave}
          onFetchCards={fetchCardsViaBackground}
          onCollapse={() => window.close()}
          onReview={handleReview}
        />
      )}
    </>
  );
}

async function getCurrentTask(): Promise<AssistantTask | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    const res: CurrentTaskResponse | undefined = await chrome.tabs.sendMessage(tab.id, {
      type: "REALGO_GET_CURRENT_TASK",
    });
    return res?.ok && res.task ? res.task : null;
  } catch {
    return null;
  }
}

function matchesTask(submission: DetectedSubmission, task: AssistantTask): boolean {
  return (
    submission.platform === task.platform &&
    submission.platformTaskSlug === task.platformTaskSlug
  );
}

export default IndexPopup;
