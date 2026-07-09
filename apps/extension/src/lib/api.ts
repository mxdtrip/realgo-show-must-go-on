import { AuthError, refreshAccessToken } from "./auth";
import { getAccessToken, getApiBaseUrl } from "./storage";
import type {
  AssistantHintPayload,
  AssistantHintResult,
  ExtensionEventResult,
  Platform,
  ProblemCardsResult,
  SubmissionPayload,
} from "./types";

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

/** Cards readiness of a problem (Bearer, like the rest of /me/*). */
export const problemCardsPath = (problemId: number) =>
  `/api/v1/me/problems/${problemId}/cards`;

/** Guided, non-solution AI hints for coding-problem pages. */
export const ASSISTANT_HINT_PATH = "/api/v1/assistant/hint";

/** The exact JSON body the backend expects (see services/api .../extension). */
interface EventRequest {
  eventId: string;
  source: Exclude<Platform, "unknown">;
  event: "problem_solved" | "problem_submitted";
  occurredAt: string;
  rating?: SubmissionPayload["userDifficulty"];
  extensionVersion?: string;
  platform?: Exclude<Platform, "unknown">;
  taskTitle?: string;
  taskUrl?: string;
  platformTaskSlug?: string;
  submitResult?: SubmissionPayload["submitResult"];
  submittedAt?: string;
  userDifficulty?: SubmissionPayload["userDifficulty"];
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
 * Accepted verdicts become solved events; every other verdict is only a submit
 * event and must not create review schedules.
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

  const submitResult = payload.submitResult ?? "accepted";
  const solved = submitResult === "accepted";

  return {
    eventId: payload.eventId,
    source: payload.platform,
    event: solved ? "problem_solved" : "problem_submitted",
    occurredAt: payload.submittedAt,
    rating: solved ? payload.userDifficulty : undefined,
    extensionVersion: manifestVersion(),
    platform: payload.platform,
    taskTitle: payload.taskTitle,
    taskUrl: payload.taskUrl,
    platformTaskSlug: externalId,
    submitResult,
    submittedAt: payload.submittedAt,
    userDifficulty: solved ? payload.userDifficulty : undefined,
    problem: {
      externalId,
      title: payload.taskTitle,
      url: payload.taskUrl,
      difficulty: payload.difficulty,
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

/**
 * Cards readiness for a problem, `GET /api/v1/me/problems/{id}/cards` (contract
 * fixed in issue #227; the backend route lands in #222/#227 — until then the
 * server answers 404 for the path itself).
 *
 * Deliberately never throws: `null` covers every unusable outcome — missing
 * route, 404 problem, auth failure, network error, malformed body — so callers
 * can treat `null` as "feature unavailable" and stay silent instead of nagging
 * the user about an endpoint that hasn't shipped yet.
 */
export async function getProblemCards(
  problemId: number
): Promise<ProblemCardsResult | null> {
  try {
    const baseUrl = await getApiBaseUrl();
    const url = `${baseUrl}${problemCardsPath(problemId)}`;

    let token = await getAccessToken();
    if (!token) token = await tryRefresh();

    let res = await authedGet(url, token);
    // Same one-shot refresh dance as saveSubmission: expired access → retry.
    if (res.status === 401) {
      token = await tryRefresh();
      res = await authedGet(url, token);
    }
    if (!res.ok) return null;

    const data = await safeJson(res);
    // /me/* handlers wrap responses in the { data: … } envelope like the events
    // endpoint; the #227 contract shows the bare object. Accept both shapes.
    const payload = data?.data ?? data;
    const status = payload?.status;
    if (status !== "ready" && status !== "generating" && status !== "none") {
      return null;
    }
    const cards = payload?.cards;
    return { status, cardsCount: Array.isArray(cards) ? cards.length : 0 };
  } catch {
    return null;
  }
}

/**
 * Requests a hint as Server-Sent Events (`?stream=1`, see
 * services/api/internal/ai/assistant_handler.go's streamHint): the model's
 * "hint" text arrives as `delta` events while it's still being generated
 * (onDelta is called for each fragment, in order), and the full structured
 * result arrives last as a `done` event. This is what lets the UI show the
 * hint as it's written instead of waiting for the whole reply.
 */
export async function streamAssistantHint(
  payload: AssistantHintPayload,
  onDelta: (text: string) => void
): Promise<AssistantHintResult> {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}${ASSISTANT_HINT_PATH}?stream=1`;
  const body = JSON.stringify(payload);

  let token = await getAccessToken();
  if (!token) token = await tryRefresh();

  let res = await authedPost(url, body, token);
  if (res.status === 401) {
    token = await tryRefresh();
    res = await authedPost(url, body, token);
  }

  if (!res.ok || !res.body) {
    const data = await safeJson(res);
    const message = data?.error?.message || `Ошибка AI-помощника (${res.status})`;
    throw new ApiError(message, res.status, data?.error?.code);
  }

  return readAssistantHintStream(res.body, onDelta);
}

async function readAssistantHintStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void
): Promise<AssistantHintResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const parsed = parseSseFrame(frame);
      if (!parsed) continue;

      if (parsed.event === "delta") {
        const data = JSON.parse(parsed.data) as { text: string };
        onDelta(data.text);
      } else if (parsed.event === "done") {
        return JSON.parse(parsed.data) as AssistantHintResult;
      } else if (parsed.event === "error") {
        const data = JSON.parse(parsed.data) as { message?: string; code?: string };
        throw new ApiError(
          data.message ?? "AI-помощник сейчас недоступен.",
          502,
          data.code
        );
      }
    }
  }
  throw new ApiError("AI-помощник прервал соединение.", 502, "stream_closed");
}

/** Parses one `event: ...\ndata: ...` SSE frame (blank-line-terminated). */
function parseSseFrame(frame: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trim());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

async function authedGet(url: string, token: string): Promise<Response> {
  return fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
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
