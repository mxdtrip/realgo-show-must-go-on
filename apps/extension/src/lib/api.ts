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
  const [baseUrl, token] = await Promise.all([getApiBaseUrl(), getAccessToken()]);

  // TODO: replace the dev access token (set on the options page) with a real
  // login/refresh flow once the extension can authenticate against /auth.
  if (!token) {
    throw new ApiError(
      "Не задан access-токен. Откройте настройки расширения и вставьте токен.",
      401,
      "no_token"
    );
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${EXTENSION_EVENTS_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new ApiError(
      `Не удалось связаться с Engram (${baseUrl}). Бэкенд запущен?`,
      0,
      "network"
    );
  }

  if (!res.ok) {
    const body = await safeJson(res);
    const message = body?.error?.message || `Ошибка сервера (${res.status})`;
    throw new ApiError(message, res.status, body?.error?.code);
  }
}

async function safeJson(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
