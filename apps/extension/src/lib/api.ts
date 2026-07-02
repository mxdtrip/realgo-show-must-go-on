import { AuthError, refreshAccessToken } from "./auth";
import { getAccessToken, getApiBaseUrl } from "./storage";
import type { ExtensionEventResult, Platform, SubmissionPayload } from "./types";

/**
 * Transport for the browser-extension ingest endpoint (implemented & merged in
 * `dev`, PR #58):
 *
 *   POST /api/v1/extension/events
 *   Authorization: Bearer <access_token>
 *   body: EventRequest (the wire contract below)
 *   200:  { "data": ExtensionEventResult }   (envelope)
 *   err:  { "error": { code, message } }
 *
 * The endpoint upserts the problem, records an extension_event, updates
 * user_problem_progress and advances the FSRS review_schedule. `userDifficulty`
 * maps 1:1 to the FSRS rating (hard|normal|easy); `eventId` makes it idempotent.
 */
export const EXTENSION_EVENTS_PATH = "/api/v1/extension/events";

/** Root liveness probe used as a connection check (not under /api/v1). */
export const HEALTH_PATH = "/healthz";

/** The exact JSON body the backend expects (see services/api .../extension). */
interface EventRequest {
  eventId: string;
  source: Exclude<Platform, "unknown">;
  event: "problem_solved";
  occurredAt: string;
  rating: SubmissionPayload["userDifficulty"];
  extensionVersion?: string;
  problem: {
    externalId: string;
    title: string;
    url: string;
    difficulty?: string;
  };
}

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

export async function saveSubmission(
  payload: SubmissionPayload
): Promise<ExtensionEventResult> {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}${EXTENSION_EVENTS_PATH}`;
  // Validate + shape the contract body before we touch the network, so bad
  // detections fail fast with a clear message instead of a 400 round-trip.
  const body = JSON.stringify(buildEventRequest(payload));

  let token = await getAccessToken();
  if (!token) {
    // No access token yet — try to mint one from a stored refresh token before
    // giving up, so a returning user doesn't have to re-login on every launch.
    token = await tryRefresh();
  }
  // Never POST with an empty bearer (#35): tryRefresh throws if there's no
  // session, so reaching here guarantees a non-empty token.

  let res = await authedPost(url, body, token);

  // Access token expired mid-session → refresh once and retry (#37/#59: 401 →
  // refresh → retry). The same body (incl. eventId) keeps the retry idempotent.
  if (res.status === 401) {
    token = await tryRefresh();
    res = await authedPost(url, body, token);
  }

  const data = await safeJson(res);
  if (!res.ok) {
    const message = data?.error?.message || `Ошибка сервера (${res.status})`;
    throw new ApiError(message, res.status, data?.error?.code);
  }

  const result = data?.data as ExtensionEventResult | undefined;
  if (!result) {
    throw new ApiError("Сервер вернул пустой ответ.", res.status, "empty_response");
  }
  return result;
}

/**
 * Maps the extension's internal payload onto the `/extension/events` contract.
 * The MVP collects a single difficulty rating; the backend consumes nothing
 * else (confirmed in services/api .../extension/models.go).
 */
function buildEventRequest(payload: SubmissionPayload): EventRequest {
  if (payload.platform === "unknown") {
    throw new ApiError("Платформа не распознана.", 0, "invalid_platform");
  }
  const externalId = payload.platformTaskSlug?.trim();
  if (!externalId) {
    throw new ApiError("Не удалось определить задачу (нет slug).", 0, "invalid_problem");
  }
  if (!payload.taskUrl?.trim()) {
    throw new ApiError("Не удалось определить ссылку на задачу.", 0, "invalid_problem");
  }
  if (!payload.eventId) {
    throw new ApiError("Отсутствует идентификатор события.", 0, "invalid_event");
  }

  return {
    eventId: payload.eventId,
    source: payload.platform,
    event: "problem_solved",
    occurredAt: payload.submittedAt,
    rating: payload.userDifficulty,
    extensionVersion: manifestVersion(),
    problem: {
      externalId,
      title: payload.taskTitle,
      url: payload.taskUrl,
    },
  };
}

function manifestVersion(): string | undefined {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return undefined;
  }
}

/**
 * Lightweight connection probe against the configured API base (`GET /healthz`,
 * #38 "status endpoint"). Used by the options page to confirm the backend is
 * reachable before login. Returns false on any network/non-2xx outcome.
 */
export async function checkApiStatus(): Promise<boolean> {
  const baseUrl = await getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}${HEALTH_PATH}`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
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
