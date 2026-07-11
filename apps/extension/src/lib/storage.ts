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
  return (await get<string>(STORAGE_KEYS.apiBaseUrl)) || DEFAULT_API_BASE_URL;
}

export function setApiBaseUrl(url: string): Promise<void> {
  return set(STORAGE_KEYS.apiBaseUrl, url.trim().replace(/\/+$/, ""));
}

export async function getWebBaseUrl(): Promise<string> {
  return (await get<string>(STORAGE_KEYS.webBaseUrl)) || DEFAULT_WEB_BASE_URL;
}

export function setWebBaseUrl(url: string): Promise<void> {
  return set(STORAGE_KEYS.webBaseUrl, url.trim().replace(/\/+$/, ""));
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

/** Persists an access + refresh pair returned by the auth endpoints. */
export async function setTokens(tokens: TokenPair): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.accessToken]: tokens.access_token,
    [STORAGE_KEYS.refreshToken]: tokens.refresh_token,
  });
}

/** Clears the session (tokens + cached email). Used on logout / expiry. */
export function clearTokens(): Promise<void> {
  return chrome.storage.local.remove([
    STORAGE_KEYS.accessToken,
    STORAGE_KEYS.refreshToken,
    STORAGE_KEYS.userEmail,
  ]);
}

export function getUserEmail(): Promise<string | undefined> {
  return get<string>(STORAGE_KEYS.userEmail);
}

export function setUserEmail(email: string): Promise<void> {
  return set(STORAGE_KEYS.userEmail, email);
}

export function getLastSubmission(): Promise<DetectedSubmission | undefined> {
  return get<DetectedSubmission>(STORAGE_KEYS.lastSubmission);
}

export function setLastSubmission(submission: DetectedSubmission): Promise<void> {
  return set(STORAGE_KEYS.lastSubmission, submission);
}

export function clearLastSubmission(): Promise<void> {
  return chrome.storage.local.remove(STORAGE_KEYS.lastSubmission);
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
