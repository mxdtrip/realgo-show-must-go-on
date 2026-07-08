/**
 * Shared types for the realgo extension.
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
  /** Topic tags read from the task page, best-effort (absent if none found). */
  tags?: string[];
  /** Difficulty read from the page, best-effort. */
  difficulty?: string;
  submitResult?: SubmitResult;
  /** ISO-8601 timestamp of when the submit was observed. */
  submittedAt: string;
}

export interface AssistantTask {
  platform: Exclude<Platform, "unknown">;
  taskTitle: string;
  taskUrl: string;
  platformTaskSlug: string;
  tags?: string[];
  difficulty?: string;
}

export type AssistantRole = "user" | "assistant";

export interface AssistantMessage {
  role: AssistantRole;
  content: string;
}

export interface AssistantHintPayload extends AssistantTask {
  message: string;
  hintLevel: number;
  history: AssistantMessage[];
}

export interface AssistantPattern {
  code: string;
  name: string;
  tier?: string;
  families?: string;
}

export interface AssistantHintResult {
  hint: string;
  question?: string;
  stage: "nudge" | "pattern" | "invariant" | "next_step" | "debug";
  problemKnown: boolean;
  patterns?: AssistantPattern[];
}

/** The full payload the popup sends to the backend after the user rates the task. */
export interface SubmissionPayload extends DetectedSubmission {
  userDifficulty: UserDifficulty;
}

/** Messages exchanged between content script, background and popup. */
export type RuntimeMessage =
  | { type: "REALGO_GET_CURRENT_TASK" }
  | { type: "REALGO_SUBMISSION_DETECTED"; submission: DetectedSubmission }
  | { type: "REALGO_SAVE_SUBMISSION"; payload: SubmissionPayload }
  | { type: "REALGO_GET_PROBLEM_CARDS"; problemId: number }
  | { type: "REALGO_GET_ASSISTANT_HINT"; payload: AssistantHintPayload }
  | {
      type: "REALGO_SYNC_WEB_SESSION";
      accessToken: string | null;
      refreshToken: string | null;
    };

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

/**
 * Cards readiness of a problem, `GET /api/v1/me/problems/{id}/cards` (contract
 * fixed in issue #227; the backend route ships in #222/#227):
 *   ready      — cards exist and are available to the user;
 *   generating — the async LLM generation holds the lock right now;
 *   none       — no cards and no generation running (unrecognised task, quota…).
 * A 404 means the problem — or, until the backend lands, the route itself —
 * does not exist; the client treats that as "feature unavailable", not an error.
 */
export type ProblemCardsStatus = "ready" | "generating" | "none";

/** What the UI needs from the cards endpoint (cards themselves stay behind). */
export interface ProblemCardsResult {
  status: ProblemCardsStatus;
  /** How many cards came with "ready" (0 for the other statuses). */
  cardsCount: number;
}

/** Reply shape for REALGO_GET_PROBLEM_CARDS (background → UI). */
export interface CardsResponse {
  ok: boolean;
  /** Present when `ok`; absent means "endpoint unavailable" — stay silent. */
  result?: ProblemCardsResult;
}

export interface AssistantHintResponse {
  ok: boolean;
  result?: AssistantHintResult;
  error?: string;
  code?: string;
}

export interface CurrentTaskResponse {
  ok: boolean;
  task?: AssistantTask;
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

export const DEFAULT_API_BASE_URL = "https://realgo.dev";

/** realgo web app (the cabinet). "К повторению" opens its review cards here. */
export const DEFAULT_WEB_BASE_URL = "https://realgo.dev";

/** Path of the spaced-repetition cards section inside the web app. */
export const REVIEW_PATH = "/cards";
