import type { DetectedSubmission } from "../lib/types";

/** Mock submission used by the Vite preview so the popup can be reviewed by URL. */
export const MOCK_SUBMISSION: DetectedSubmission = {
  eventId: "mock-event-0001",
  platform: "hackerrank",
  taskTitle: "Two Sum II",
  taskUrl: "https://www.hackerrank.com/challenges/two-integer-sum-ii/problem",
  platformTaskSlug: "two-integer-sum-ii",
  tags: ["arrays", "two pointers", "binary search"],
  difficulty: "medium",
  submitResult: "accepted",
  submittedAt: new Date().toISOString(),
};
