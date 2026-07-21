import {
  ASSISTANT_STATE_KEY_PREFIX,
  DEFAULT_API_BASE_URL,
  DEFAULT_WEB_BASE_URL,
  REVIEW_PATH,
  STORAGE_KEYS,
  type AssistantPersistedState,
  type DetectedSubmission,
  type TokenPair,
} from "./types";

/**
 * Thin wrapper over chrome.storage.local. Kept out of the popup component so the
 * popup stays a pure React view that can also render in the Vite preview.
 */

async function get<T>(key: string): Promise<T | undefined> {
  const res = await chrome.storage.local.get(key);
  return res[key] as T | undefined;
}

async function set(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getApiBaseUrl(): Promise<string> {
  const stored = await get<string>(STORAGE_KEYS.apiBaseUrl);
  try {
    return normalizeServiceBaseUrl(stored || DEFAULT_API_BASE_URL);
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

export function setApiBaseUrl(url: string): Promise<void> {
  return set(STORAGE_KEYS.apiBaseUrl, normalizeServiceBaseUrl(url));
}

export async function getWebBaseUrl(): Promise<string> {
  const stored = await get<string>(STORAGE_KEYS.webBaseUrl);
  try {
    return normalizeServiceBaseUrl(stored || DEFAULT_WEB_BASE_URL);
  } catch {
    return DEFAULT_WEB_BASE_URL;
  }
}

export function setWebBaseUrl(url: string): Promise<void> {
  return set(STORAGE_KEYS.webBaseUrl, normalizeServiceBaseUrl(url));
}

/** HTTPS is required off-device; plaintext HTTP is limited to loopback dev. */
export function normalizeServiceBaseUrl(raw: string): string {
  const parsed = new URL(raw.trim());
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    throw new Error("Используй HTTPS; HTTP разрешён только для localhost.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URL не должен содержать логин или пароль.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("URL не должен содержать query-параметры или fragment.");
  }
  if (parsed.pathname !== "/") {
    throw new Error("URL сервиса не должен содержать путь.");
  }
  return parsed.origin;
}

/** Absolute URL of the review cards section, e.g. https://realgo.dev/cards. */
export async function getReviewUrl(): Promise<string> {
  return (await getWebBaseUrl()) + REVIEW_PATH;
}

export function getAccessToken(): Promise<string | undefined> {
  return get<string>(STORAGE_KEYS.accessToken);
}

export function setAccessToken(token: string): Promise<void> {
  return set(STORAGE_KEYS.accessToken, token.trim());
}

export function getRefreshToken(): Promise<string | undefined> {
  return get<string>(STORAGE_KEYS.refreshToken);
}

export function getWebSessionFingerprint(): Promise<string | undefined> {
  return get<string>(STORAGE_KEYS.webSessionFingerprint);
}

export function setWebSessionFingerprint(fingerprint: string): Promise<void> {
  return set(STORAGE_KEYS.webSessionFingerprint, fingerprint);
}

/** Persists an access + refresh pair returned by the auth endpoints. */
export async function setTokens(tokens: TokenPair): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.accessToken]: tokens.access_token,
    [STORAGE_KEYS.refreshToken]: tokens.refresh_token,
  });
}

/**
 * Clears the account session and (by default) all account-scoped cached
 * data. API/Web URL preferences are intentionally retained because they
 * belong to the extension installation rather than to a particular user.
 *
 * `keepAssistantState` exists for the passive/silent session-loss path
 * (an access-token refresh discovered the session is gone, e.g. from a
 * background cards poll) — the user didn't choose to end anything and is
 * almost certainly about to log back into the same account, so wiping every
 * open task's AI conversation history/hint progress out from under them is
 * pure loss with no privacy benefit. An explicit logout, or the web app
 * handing off to a different account, still wants the full wipe (leaving
 * another account's assistant history behind on a shared device would be
 * the actual privacy problem there) and must not pass this.
 */
export async function clearTokens(options?: { keepAssistantState?: boolean }): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const accountKeys = options?.keepAssistantState
    ? []
    : Object.keys(all).filter((key) => key.startsWith(ASSISTANT_STATE_KEY_PREFIX));
  await chrome.storage.local.remove([
    STORAGE_KEYS.accessToken,
    STORAGE_KEYS.refreshToken,
    STORAGE_KEYS.userEmail,
    STORAGE_KEYS.webSessionFingerprint,
    STORAGE_KEYS.pendingSubmissions,
    ...accountKeys,
  ]);
}

export function getUserEmail(): Promise<string | undefined> {
  return get<string>(STORAGE_KEYS.userEmail);
}

export function setUserEmail(email: string): Promise<void> {
  return set(STORAGE_KEYS.userEmail, email);
}

/** Newest, more room for retries than any realistic number of tabs a user
    would actually leave mid-rating at once; older entries are dropped. */
const MAX_PENDING_SUBMISSIONS = 5;

async function readPendingSubmissions(): Promise<DetectedSubmission[]> {
  const stored = await get<DetectedSubmission[]>(STORAGE_KEYS.pendingSubmissions);
  return Array.isArray(stored) ? stored : [];
}

/** All accepted submissions still waiting to be rated, oldest first. */
export function getPendingSubmissions(): Promise<DetectedSubmission[]> {
  return readPendingSubmissions();
}

/**
 * Queues a newly detected accepted submission. This used to be a single
 * global "last submission" slot: two tabs detecting an accepted submit
 * independently (even for different tasks) both wrote it, and the second
 * write silently discarded the first tab's still-unrated submission from
 * the toolbar popup's point of view. Re-adding the same eventId (e.g. a
 * background retry) replaces the earlier entry instead of duplicating it.
 */
export async function addPendingSubmission(submission: DetectedSubmission): Promise<void> {
  const current = await readPendingSubmissions();
  const next = [...current.filter((item) => item.eventId !== submission.eventId), submission].slice(
    -MAX_PENDING_SUBMISSIONS
  );
  await set(STORAGE_KEYS.pendingSubmissions, next);
}

/** Removes one submission (by eventId) once it's been rated and saved. */
export async function removePendingSubmission(eventId: string): Promise<void> {
  const current = await readPendingSubmissions();
  await set(
    STORAGE_KEYS.pendingSubmissions,
    current.filter((item) => item.eventId !== eventId)
  );
}

/** A day: assistant state older than this is stale (limits reset per task/day). */
const ASSISTANT_STATE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Loads the persisted assistant conversation for a task and, piggybacking on
 * the same storage read, prunes stale entries for other tasks so the store
 * doesn't accumulate one record per problem ever opened.
 */
export async function getAssistantState(
  taskKey: string
): Promise<AssistantPersistedState | undefined> {
  const all = await chrome.storage.local.get(null);
  const staleKeys: string[] = [];
  const cutoff = Date.now() - ASSISTANT_STATE_TTL_MS;
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(ASSISTANT_STATE_KEY_PREFIX)) continue;
    const savedAt = (value as AssistantPersistedState | undefined)?.savedAt ?? 0;
    if (savedAt < cutoff) staleKeys.push(key);
  }
  if (staleKeys.length > 0) {
    await chrome.storage.local.remove(staleKeys);
  }

  const key = ASSISTANT_STATE_KEY_PREFIX + taskKey;
  if (staleKeys.includes(key)) return undefined;
  return all[key] as AssistantPersistedState | undefined;
}

export function setAssistantState(
  taskKey: string,
  state: AssistantPersistedState
): Promise<void> {
  return set(ASSISTANT_STATE_KEY_PREFIX + taskKey, state);
}
