import {
  DEFAULT_API_BASE_URL,
  STORAGE_KEYS,
  type DetectedSubmission,
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

export function getAccessToken(): Promise<string | undefined> {
  return get<string>(STORAGE_KEYS.accessToken);
}

export function setAccessToken(token: string): Promise<void> {
  return set(STORAGE_KEYS.accessToken, token.trim());
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
