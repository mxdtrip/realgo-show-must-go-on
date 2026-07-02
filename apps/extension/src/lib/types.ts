/**
 * Shared types for the realgo extension.
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
  /**
   * Stable per-submit idempotency key (uuid). Generated once when the submit is
   * detected, so retries — and the overlay vs. toolbar-popup save paths — reuse
   * the same value and the backend dedupes by it (`eventId` in the contract).
   */
  eventId: string;
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
}

/** Messages exchanged between content script, background and popup. */
export type RuntimeMessage =
  | { type: "REALGO_SUBMISSION_DETECTED"; submission: DetectedSubmission }
  | { type: "REALGO_SAVE_SUBMISSION"; payload: SubmissionPayload };

/**
 * Parsed result of a successful `POST /api/v1/extension/events` (the backend
 * returns it under the envelope's `data` field). `duplicate` is the idempotency
 * signal — true when this `eventId` was already ingested.
 */
export interface ExtensionEventResult {
  accepted: boolean;
  duplicate: boolean;
  problemId: number;
  status: string;
  nextReviewAt: string | null;
}

/** Reply shape for REALGO_SAVE_SUBMISSION (background → UI). */
export interface SaveResponse {
  ok: boolean;
  /** Present when `ok`: the backend's idempotent result. */
  result?: ExtensionEventResult;
  /** Present when `!ok`: human-readable reason for the UI. */
  error?: string;
  /** Present when `!ok`: machine code, e.g. "unauthorized" | "network". */
  code?: string;
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
  lastSubmission: "realgo:lastSubmission",
  apiBaseUrl: "realgo:apiBaseUrl",
  webBaseUrl: "realgo:webBaseUrl",
  accessToken: "realgo:accessToken",
  refreshToken: "realgo:refreshToken",
  userEmail: "realgo:userEmail",
} as const;

export const DEFAULT_API_BASE_URL = "http://localhost:8080";

/** realgo web app (the cabinet). "К повторению" opens its review cards here. */
export const DEFAULT_WEB_BASE_URL = "http://localhost:3000";

/** Path of the spaced-repetition cards section inside the web app. */
export const REVIEW_PATH = "/cards";
