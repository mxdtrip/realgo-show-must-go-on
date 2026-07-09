import { useEffect, useState } from "react";

import { AssistantApp } from "./assistant/AssistantApp";
import { streamAssistantHintViaBackground } from "./lib/assistantClient";
import { fetchCardsViaBackground } from "./lib/cardsClient";
import { clearLastSubmission, getLastSubmission, getReviewUrl } from "./lib/storage";
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
    Promise.all([getLastSubmission().catch(() => undefined), getCurrentTask()])
      .then(([lastSubmission, task]) => {
        if (!alive) return;
        setCurrentTask(task);
        setSubmission(
          lastSubmission && isAcceptedForTask(lastSubmission, task)
            ? lastSubmission
            : null
        );
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

function isAcceptedForTask(
  submission: DetectedSubmission,
  task: AssistantTask | null
): boolean {
  if (!task || submission.submitResult !== "accepted") return false;
  return (
    submission.platform === task.platform &&
    submission.platformTaskSlug === task.platformTaskSlug
  );
}

export default IndexPopup;
