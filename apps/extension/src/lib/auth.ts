import {
  clearTokens,
  getApiBaseUrl,
  getRefreshToken,
  getUserEmail,
  setTokens,
  setUserEmail,
} from "./storage";
import type { AuthUser, TokenPair } from "./types";

/**
 * Authentication against the existing Go API (`/api/v1/auth/*`).
 *
 * The extension stores the access + refresh pair in chrome.storage and refreshes
 * the access token on demand (see api.ts). This replaces the earlier dev-mode
 * "paste an access token" flow.
 *
 * Endpoints used (already implemented server-side):
 *   POST /api/v1/auth/login    { email, password }   → { data: { user, tokens } }
 *   POST /api/v1/auth/refresh  { refresh_token }      → { data: { tokens } }
 *   POST /api/v1/auth/logout   { refresh_token }      → revokes the refresh token
 */
const AUTH_BASE = "/api/v1/auth";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function postJson(url: string, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError("Не удалось связаться с realgo. Бэкенд запущен?", 0, "network");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error?.message || `Ошибка входа (${res.status})`;
    throw new AuthError(message, res.status, data?.error?.code);
  }
  return data?.data ?? null;
}

/** Logs in with email + password and persists the issued tokens. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const baseUrl = await getApiBaseUrl();
  const data = await postJson(`${baseUrl}${AUTH_BASE}/login`, {
    email: email.trim(),
    password,
  });

  const tokens = data?.tokens as TokenPair | undefined;
  const user = data?.user as AuthUser | undefined;
  if (!tokens?.access_token) {
    throw new AuthError("Сервер не вернул токены доступа.", 500, "no_tokens");
  }

  await setTokens(tokens);
  if (user?.email) await setUserEmail(user.email);
  return user ?? { id: 0, email: email.trim() };
}

/**
 * Exchanges the stored refresh token for a fresh access token.
 * Throws AuthError(401) when there is no refresh token or it is rejected; the
 * caller is expected to clear the session and ask the user to log in again.
 */
export async function refreshAccessToken(): Promise<string> {
  const [baseUrl, refresh] = await Promise.all([getApiBaseUrl(), getRefreshToken()]);
  if (!refresh) {
    throw new AuthError("Сессия не найдена. Войдите в аккаунт.", 401, "no_session");
  }

  let data: any;
  try {
    data = await postJson(`${baseUrl}${AUTH_BASE}/refresh`, { refresh_token: refresh });
  } catch (e) {
    if (e instanceof AuthError && e.status === 401) await clearTokens();
    throw e;
  }

  const tokens = data?.tokens as TokenPair | undefined;
  if (!tokens?.access_token) {
    await clearTokens();
    throw new AuthError("Сессия истекла. Войдите снова.", 401, "refresh_failed");
  }
  await setTokens(tokens);
  return tokens.access_token;
}

/** Best-effort logout: revokes the refresh token, then clears local session. */
export async function logout(): Promise<void> {
  const [baseUrl, refresh] = await Promise.all([getApiBaseUrl(), getRefreshToken()]);
  if (refresh) {
    try {
      await fetch(`${baseUrl}${AUTH_BASE}/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
    } catch {
      /* network failure shouldn't block local logout */
    }
  }
  await clearTokens();
}

/** Returns the cached email when a session exists, else undefined. */
export async function getCurrentUserEmail(): Promise<string | undefined> {
  const [email, refresh] = await Promise.all([getUserEmail(), getRefreshToken()]);
  return refresh ? email : undefined;
}

/**
 * Mirrors the realgo.dev web session into the extension's own storage, so the
 * user doesn't have to log in twice. The web app is the source of truth: no
 * refresh token means the web session logged out (or never started), and the
 * extension follows suit.
 *
 * The web page fires both a `storage` event (cross-tab) and a same-tab
 * `realgo:auth-changed` event on every token change, so two sync calls can
 * land back-to-back (e.g. the web app's own 401 → refresh → re-sync, right
 * after our first sync already raced the same refresh). Chained through
 * `syncChain` so calls run one at a time instead of interleaving their
 * read-current / store-new steps.
 */
let syncChain: Promise<void> = Promise.resolve();

export function syncWebSession(
  accessToken: string | null,
  refreshToken: string | null
): Promise<void> {
  syncChain = syncChain
    .catch(() => {
      /* previous call's failure shouldn't block the next one */
    })
    .then(() => syncWebSessionOnce(accessToken, refreshToken));
  return syncChain;
}

async function syncWebSessionOnce(
  accessToken: string | null,
  refreshToken: string | null
): Promise<void> {
  const current = await getRefreshToken();
  console.log("[realgo] syncWebSession", {
    hasCurrent: Boolean(current),
    sameAsCurrent: current === refreshToken,
    incomingHasRefresh: Boolean(refreshToken),
  });

  if (!refreshToken) {
    if (current) await clearTokens();
    return;
  }
  if (current === refreshToken) return; // already in sync, skip the /users/me round-trip

  await setTokens({
    access_token: accessToken ?? "",
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 0,
  });
  console.log("[realgo] syncWebSession: tokens stored");

  // Best-effort email lookup, deliberately one-shot (no 401 → refresh retry):
  // the access token handed over here may already be the stale one the web
  // tab itself is about to replace (its own /users/me 401 kicks off a
  // refresh). Retrying with the extension's own tryRefresh() would race the
  // web tab for the same one-time-use refresh token and could invalidate it
  // for whichever side loses. A miss here just means the email fills in on
  // the next auth-changed re-sync, once the web tab's refresh has landed.
  await fetchEmailBestEffort(accessToken);
}

async function fetchEmailBestEffort(accessToken: string | null): Promise<void> {
  if (!accessToken) return;
  try {
    const baseUrl = await getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    const user = data?.data?.user as AuthUser | undefined;
    console.log("[realgo] syncWebSession: users/me ->", user);
    if (user?.email) await setUserEmail(user.email);
  } catch (e) {
    console.error("[realgo] syncWebSession: users/me failed", e);
  }
}
