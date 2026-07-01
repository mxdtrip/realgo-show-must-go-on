import type { DetectedSubmission } from "../lib/types";

/** Mock submission used by the Vite preview so the popup can be reviewed by URL. */
export const MOCK_SUBMISSION: DetectedSubmission = {
  eventId: "mock-event-0001",
  platform: "neetcode",
  taskTitle: "Two Sum II",
  taskUrl: "https://neetcode.io/problems/two-integer-sum-ii",
  platformTaskSlug: "two-integer-sum-ii",
  submitResult: "accepted",
  submittedAt: new Date().toISOString(),
};
