import type { DetectedSubmission } from "../lib/types";

/** Mock submission used by the Vite preview so the popup can be reviewed by URL. */
export const MOCK_SUBMISSION: DetectedSubmission = {
  platform: "neetcode",
  taskTitle: "Two Sum II",
  taskUrl: "https://neetcode.io/problems/two-integer-sum-ii",
  platformTaskSlug: "two-integer-sum-ii",
  submitResult: "accepted",
  tags: ["arrays", "two pointers"],
  submittedAt: new Date().toISOString(),
};
