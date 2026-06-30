import { useEffect, useState } from "react";

import { saveSubmission } from "./lib/api";
import { clearLastSubmission, getLastSubmission } from "./lib/storage";
import type { DetectedSubmission, SubmissionPayload } from "./lib/types";
import { PopupApp } from "./popup/PopupApp";

/**
 * Toolbar popup entry. Shows the most recently detected submission (stored by
 * the background worker), so clicking the Engram icon after a submit always
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

  async function handleSave(payload: SubmissionPayload) {
    await saveSubmission(payload);
    await clearLastSubmission();
    try {
      await chrome.action.setBadgeText({ text: "" });
    } catch {
      /* action API may be unavailable in some contexts */
    }
  }

  return (
    <PopupApp
      submission={submission}
      onSave={handleSave}
      onClose={() => window.close()}
    />
  );
}

export default IndexPopup;
