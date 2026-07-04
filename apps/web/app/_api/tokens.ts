"use client";

// Client-side token store. Tokens live in localStorage so the SPA-style cabinet
// can attach the Bearer header and survive reloads. A change event lets the auth
// provider and route guard react to login/logout across tabs and components.

import type { AuthTokens } from "./types";

export const accessTokenStorageKey = "realgo:auth:access:v1";
export const refreshTokenStorageKey = "realgo:auth:refresh:v1";
export const authChangedEvent = "realgo:auth-changed";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(accessTokenStorageKey);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(refreshTokenStorageKey);
}

export function hasSession(): boolean {
  return getRefreshToken() !== null;
}

/** Persists a freshly issued token pair and notifies listeners. */
export function setTokens(tokens: AuthTokens) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(accessTokenStorageKey, tokens.access_token);
  window.localStorage.setItem(refreshTokenStorageKey, tokens.refresh_token);
  window.dispatchEvent(new Event(authChangedEvent));
}

/** Clears the session and notifies listeners. */
export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(accessTokenStorageKey);
  window.localStorage.removeItem(refreshTokenStorageKey);
  window.dispatchEvent(new Event(authChangedEvent));
}
