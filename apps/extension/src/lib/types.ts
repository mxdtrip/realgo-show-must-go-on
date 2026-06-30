/**
 * Shared types for the Engram extension.
 *
 * TODO: promote the cross-cutting payload/DTO types (SubmissionPayload,
 * UserDifficulty, CanSolveAgain) into `packages/shared` once that package is
 * wired up, so the Go API client and the web app can share the same contract.
 */

export type Platform = "leetcode" | "neetcode" | "unknown";

export type SubmitResult =
  | "accepted"
  | "wrong_answer"
  | "runtime_error"
  | "time_limit"
  | "unknown";

export type UserDifficulty = "hard" | "normal" | "easy";

export type CanSolveAgain = "no" | "probably" | "yes";

/** What the content script detects on the page and hands to the popup. */
export interface DetectedSubmission {
  platform: Platform;
  taskTitle: string;
  taskUrl: string;
  platformTaskSlug?: string;
  submitResult?: SubmitResult;
  /** ISO-8601 timestamp of when the submit was observed. */
  submittedAt: string;
}

/** The full payload the popup sends to the backend after the user rates the task. */
export interface SubmissionPayload extends DetectedSubmission {
  userDifficulty: UserDifficulty;
  canSolveAgain: CanSolveAgain;
}

/** Messages exchanged between content script, background and popup. */
export type RuntimeMessage =
  | { type: "ENGRAM_SUBMISSION_DETECTED"; submission: DetectedSubmission }
  | { type: "ENGRAM_SAVE_SUBMISSION"; payload: SubmissionPayload };

/** Reply shape for ENGRAM_SAVE_SUBMISSION. */
export interface SaveResponse {
  ok: boolean;
  error?: string;
}

export const STORAGE_KEYS = {
  lastSubmission: "engram:lastSubmission",
  apiBaseUrl: "engram:apiBaseUrl",
  accessToken: "engram:accessToken",
} as const;

export const DEFAULT_API_BASE_URL = "http://localhost:8080";
