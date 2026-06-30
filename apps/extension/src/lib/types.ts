/**
 * Shared types for the Engram extension.
 *
 * TODO: promote the cross-cutting payload/DTO types (SubmissionPayload,
 * UserDifficulty) into `packages/shared` once that package is
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

/** What the content script detects on the page and hands to the popup. */
export interface DetectedSubmission {
  platform: Platform;
  taskTitle: string;
  taskUrl: string;
  platformTaskSlug?: string;
  submitResult?: SubmitResult;
  /** Topic tags for the task (e.g. ["arrays", "two pointers"]), best-effort. */
  tags?: string[];
  /** ISO-8601 timestamp of when the submit was observed. */
  submittedAt: string;
}

/** The full payload the popup sends to the backend after the user rates the task. */
export interface SubmissionPayload extends DetectedSubmission {
  userDifficulty: UserDifficulty;
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

/** Token pair returned by the backend auth endpoints (snake_case = wire format). */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

/** Minimal authenticated user shape the extension keeps around. */
export interface AuthUser {
  id: number;
  email: string;
}

export const STORAGE_KEYS = {
  lastSubmission: "engram:lastSubmission",
  apiBaseUrl: "engram:apiBaseUrl",
  accessToken: "engram:accessToken",
  refreshToken: "engram:refreshToken",
  userEmail: "engram:userEmail",
} as const;

export const DEFAULT_API_BASE_URL = "http://localhost:8080";
