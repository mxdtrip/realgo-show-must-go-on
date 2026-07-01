import { AuthError, refreshAccessToken } from "./auth";
import { getAccessToken, getApiBaseUrl } from "./storage";
import type { SubmissionPayload } from "./types";

/**
 * Planned backend contract (NOT yet implemented server-side — this branch is
 * frontend-only). The Go API already has the `extension_events` table, the
 * `problems` table with source_type='extension', and the FSRS reviews module;
 * the matching handler is the next backend step:
 *
 *   POST /api/v1/extension/events
 *   Authorization: Bearer <access_token>
 *   body: SubmissionPayload
 *
 * The endpoint is expected to upsert the problem, insert an extension_event,
 * update user_problem_progress and enqueue/advance a review_schedule via FSRS
 * (userDifficulty maps 1:1 to the FSRS rating hard|normal|easy).
 */
export const EXTENSION_EVENTS_PATH = "/api/v1/extension/events";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function saveSubmission(payload: SubmissionPayload): Promise<void> {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}${EXTENSION_EVENTS_PATH}`;
  const body = JSON.stringify(payload);

  let token = await getAccessToken();
  if (!token) {
    // No access token yet — try to mint one from a stored refresh token before
    // giving up, so a returning user doesn't have to re-login on every launch.
    token = await tryRefresh();
  }

  let res = await authedPost(url, body, token);

  // Access token expired mid-session → refresh once and retry.
  if (res.status === 401) {
    token = await tryRefresh();
    res = await authedPost(url, body, token);
  }

  if (!res.ok) {
    const data = await safeJson(res);
    const message = data?.error?.message || `Ошибка сервера (${res.status})`;
    throw new ApiError(message, res.status, data?.error?.code);
  }
}

/** Refreshes the access token, translating "no session" into a friendly error. */
async function tryRefresh(): Promise<string> {
  try {
    return await refreshAccessToken();
  } catch (e) {
    if (e instanceof AuthError) {
      throw new ApiError(
        "Аккаунт не подключён. Откройте настройки расширения и войдите в realgo.",
        401,
        e.code ?? "unauthorized"
      );
    }
    throw e;
  }
}

async function authedPost(url: string, body: string, token: string): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
    });
  } catch {
    throw new ApiError(
      "Не удалось связаться с realgo. Проверьте, что бэкенд запущен.",
      0,
      "network"
    );
  }
}

async function safeJson(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
