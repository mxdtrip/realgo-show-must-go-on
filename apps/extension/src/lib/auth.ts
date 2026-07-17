import {
  clearTokens,
  getApiBaseUrl,
  getRefreshToken,
  getUserEmail,
  getWebSessionFingerprint,
  setWebSessionFingerprint,
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

async function postAuthorizedJson(url: string, accessToken: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  } catch {
    throw new AuthError("Не удалось связаться с realgo. Бэкенд запущен?", 0, "network");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error?.message || `Ошибка сессии (${res.status})`;
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
  if (!tokens?.access_token || !tokens.refresh_token) {
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
let refreshInFlight: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = doRefreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefreshAccessToken(): Promise<string> {
  const [baseUrl, refresh] = await Promise.all([getApiBaseUrl(), getRefreshToken()]);
  if (!refresh) {
    throw new AuthError("Сессия не найдена. Войдите в аккаунт.", 401, "no_session");
  }

  let data: any;
  try {
    data = await postJson(`${baseUrl}${AUTH_BASE}/refresh`, { refresh_token: refresh });
  } catch (e) {
    if (e instanceof AuthError && e.status === 401 && (await getRefreshToken()) === refresh) {
      await clearTokens();
    }
    throw e;
  }

  const tokens = data?.tokens as TokenPair | undefined;
  if (!tokens?.access_token) {
    if ((await getRefreshToken()) === refresh) await clearTokens();
    throw new AuthError("Сессия истекла. Войдите снова.", 401, "refresh_failed");
  }
  if ((await getRefreshToken()) !== refresh) {
    throw new AuthError("Сессия изменилась. Повторите действие.", 409, "session_changed");
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
  // Do not wipe a newer login/device sync that completed while revocation was
  // in flight.
  if (!refresh || (await getRefreshToken()) === refresh) await clearTokens();
}

/** Returns the cached email when a session exists, else undefined. */
export async function getCurrentUserEmail(): Promise<string | undefined> {
  const [email, refresh] = await Promise.all([getUserEmail(), getRefreshToken()]);
  return refresh ? email : undefined;
}

/**
 * Exchanges the realgo.dev web session for an independent extension device
 * session, so the user doesn't have to log in twice. The web app is the source
 * of truth: no refresh token means the web session logged out (or never
 * started), and the extension follows suit.
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
  const [current, currentFingerprint, currentEmail] = await Promise.all([
    getRefreshToken(),
    getWebSessionFingerprint(),
    getUserEmail(),
  ]);
  const incomingFingerprint = refreshToken ? await tokenFingerprint(refreshToken) : undefined;
  const currentTokenFingerprint = current ? await tokenFingerprint(current) : undefined;
  const hasIndependentDeviceSession =
    Boolean(current) &&
    (currentFingerprint === undefined || currentTokenFingerprint !== currentFingerprint);
  console.log("[realgo] syncWebSession", {
    hasCurrent: Boolean(current),
    sameWebSession: currentFingerprint === incomingFingerprint,
    hasIndependentDeviceSession,
    incomingHasRefresh: Boolean(refreshToken),
  });

  if (!refreshToken) {
    if (current || currentFingerprint) await clearTokens();
    return;
  }
  if (current && currentFingerprint === incomingFingerprint) return;

  // Resolve the web identity with the access token only. A stale access token
  // is left alone: the web app will emit another auth-changed event immediately
  // after it completes its own refresh, without the extension racing for that
  // one-time token.
  const webUser = await fetchWebUser(accessToken);
  if (!webUser) return;

  // A rotating web token changed, but the user did not: keep a genuinely
  // independent extension session and only remember the new web-session
  // marker. A rolling-upgrade fallback stores the web refresh itself; its
  // fingerprint therefore matches currentFingerprint and it must be replaced
  // on every web rotation instead of being mistaken for a device session.
  if (current && currentEmail === webUser.email && hasIndependentDeviceSession) {
    await setWebSessionFingerprint(incomingFingerprint!);
    return;
  }

  if (current) await clearTokens();

  const baseUrl = await getApiBaseUrl();
  let data: any;
  try {
    data = await postAuthorizedJson(`${baseUrl}${AUTH_BASE}/device-session`, accessToken!);
  } catch (e) {
    // Compatibility with an older backend during a rolling/local upgrade. The
    // fallback preserves the previous behaviour; once the additive endpoint is
    // deployed, web and extension sessions are fully independent.
    if (!(e instanceof AuthError) || (e.status !== 404 && e.status !== 405)) throw e;
    data = {
      tokens: {
        access_token: accessToken ?? "",
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: 0,
      } satisfies TokenPair,
    };
  }

  const tokens = data?.tokens as TokenPair | undefined;
  if (!tokens?.access_token || !tokens.refresh_token) {
    throw new AuthError("Сервер не вернул отдельную сессию расширения.", 500, "no_tokens");
  }

  await Promise.all([
    setTokens(tokens),
    setUserEmail(webUser.email),
    setWebSessionFingerprint(incomingFingerprint!),
  ]);
  console.log("[realgo] syncWebSession: independent device session stored");
}

async function fetchWebUser(accessToken: string | null): Promise<AuthUser | null> {
  if (!accessToken) return null;
  try {
    const baseUrl = await getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const user = data?.data?.user as AuthUser | undefined;
    console.log("[realgo] syncWebSession: users/me ->", user);
    return user?.email ? user : null;
  } catch (e) {
    console.error("[realgo] syncWebSession: users/me failed", e);
    return null;
  }
}

async function tokenFingerprint(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
