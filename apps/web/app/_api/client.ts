"use client";

// Typed fetch wrapper around the Go API: attaches the Bearer token, unwraps the
// { data } / { error } envelope, and transparently refreshes the access token
// once on a 401 before retrying the original request.

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  refreshTokenStorageKey,
  setTokens,
} from "./tokens";
import { ApiError, type ApiEnvelope, type ApiErrorBody, type AuthTokens } from "./types";

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
// The deployed app is fronted by Caddy, which routes same-origin `/api/*` to
// the Go service. Missing configuration must therefore stay same-origin; a
// localhost fallback would send production users to their own machines.
const API_BASE = configuredApiBase ? configuredApiBase.replace(/\/$/, "") : "";

const API_PREFIX = "/api/v1";
const REFRESH_LEASE_KEY = "realgo:auth-refresh-lease:v1";
const REFRESH_LEASE_TTL_MS = 30_000;
const REFRESH_LEASE_SETTLE_MS = 40;
const REFRESH_LEASE_RETRY_MS = 100;

export type RequestOptions = {
  method?: string;
  /** JSON-serialisable body; omit for GET. */
  body?: unknown;
  /** Attach the Bearer access token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
};

/** Low-level request that parses the complete envelope and throws ApiError on failure. */
async function rawEnvelopeRequest<T, M = unknown>(
  path: string,
  options: RequestOptions,
  token: string | null,
): Promise<ApiEnvelope<T, M>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${API_PREFIX}${path}`, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch {
    throw new ApiError("Не удалось связаться с сервером. Проверьте, что бэкенд запущен.", 0, "network");
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (payload as { error?: ApiErrorBody } | null)?.error;
    throw new ApiError(err?.message ?? `Ошибка сервера (${res.status})`, res.status, err?.code ?? "error");
  }

  // 204/пустое тело — валидный успех (DELETE-ручки): отдаём пустой конверт.
  return (payload ?? {}) as ApiEnvelope<T, M>;
}

/** Low-level request that unwraps data and throws ApiError on failure. */
async function rawRequest<T>(path: string, options: RequestOptions, token: string | null): Promise<T> {
  const envelope = await rawEnvelopeRequest<T>(path, options, token);
  return envelope.data;
}

// Single-flight guard: the backend rotates the refresh token atomically (the
// old one is deleted the moment a refresh succeeds), so two concurrent
// refreshes would race — the loser sends an already-consumed token, gets a 401
// and wipes a perfectly valid session. Typical trigger: several API calls fire
// together after the access token expired (e.g. returning to the dashboard).
// All concurrent callers must therefore share one in-flight refresh.
let refreshInFlight: Promise<string> | null = null;

type RefreshLease = {
  owner: string;
  expiresAt: number;
};

function refreshCoordinationError(): ApiError {
  return new ApiError(
    "Браузер не поддерживает безопасное обновление сессии между вкладками. Закройте лишние вкладки и войдите снова.",
    0,
    "refresh_lock_unavailable",
  );
}

function readRefreshLease(): RefreshLease | null {
  try {
    const raw = window.localStorage.getItem(REFRESH_LEASE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RefreshLease>;
    return typeof parsed.owner === "string" && typeof parsed.expiresAt === "number"
      ? { owner: parsed.owner, expiresAt: parsed.expiresAt }
      : null;
  } catch {
    throw refreshCoordinationError();
  }
}

function writeRefreshLease(lease: RefreshLease) {
  try {
    window.localStorage.setItem(REFRESH_LEASE_KEY, JSON.stringify(lease));
  } catch {
    throw refreshCoordinationError();
  }
}

function waitForRefreshSignal(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let timer = 0;
    const finish = () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", onStorage);
      resolve();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === REFRESH_LEASE_KEY || event.key === refreshTokenStorageKey) finish();
    };
    timer = window.setTimeout(finish, timeoutMs);
    window.addEventListener("storage", onStorage);
  });
}

async function withRefreshLease<T>(action: () => Promise<T>): Promise<T> {
  if (typeof window === "undefined") throw refreshCoordinationError();
  const owner =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  for (;;) {
    const current = readRefreshLease();
    const now = Date.now();
    if (!current || current.expiresAt <= now) {
      writeRefreshLease({ owner, expiresAt: now + REFRESH_LEASE_TTL_MS });

      // Confirm ownership after a short settle window. If two tabs observed an
      // expired lease together, only the last writer still sees its owner id
      // and proceeds; the other returns to the wait loop.
      await waitForRefreshSignal(REFRESH_LEASE_SETTLE_MS);
      if (readRefreshLease()?.owner === owner) {
        const heartbeat = window.setInterval(() => {
          try {
            if (readRefreshLease()?.owner === owner) {
              writeRefreshLease({ owner, expiresAt: Date.now() + REFRESH_LEASE_TTL_MS });
            }
          } catch {
            // The in-flight exchange still guards against overwriting a newer
            // token. A later caller will get the explicit storage error.
          }
        }, REFRESH_LEASE_TTL_MS / 3);

        try {
          return await action();
        } finally {
          window.clearInterval(heartbeat);
          try {
            if (readRefreshLease()?.owner === owner) {
              window.localStorage.removeItem(REFRESH_LEASE_KEY);
            }
          } catch {
            // Nothing else can be done if storage became unavailable during
            // cleanup; the lease expires naturally.
          }
        }
      }
    }

    await waitForRefreshSignal(REFRESH_LEASE_RETRY_MS);
  }
}

/** Exchanges the stored refresh token for a new access token, or throws. */
export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = doRefreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefreshAccessToken(): Promise<string> {
  const initialRefresh = getRefreshToken();
  const initialSubject = accessTokenSubject(getAccessToken());
  if (!initialRefresh) {
    throw new ApiError("Сессия не найдена. Войдите в аккаунт.", 401, "no_session");
  }

  // refreshInFlight protects one tab. Web Locks extends the same guarantee to
  // every tab on this origin: after waiting, a loser reuses the token pair the
  // winner already stored instead of submitting the consumed refresh token.
  const locks =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { locks?: LockManager }).locks
      : undefined;
  if (locks) {
    return locks.request("realgo-auth-refresh", () =>
      refreshCurrentSession(initialRefresh, initialSubject),
    );
  }

  // Safari and embedded webviews may not expose Web Locks. Coordinate through
  // a short renewable localStorage lease instead of silently falling back to
  // unsafe per-tab single-flight behavior.
  return withRefreshLease(() => refreshCurrentSession(initialRefresh, initialSubject));
}

function refreshCurrentSession(initialRefresh: string, initialSubject: string | null): Promise<string> {
  const currentRefresh = getRefreshToken();
  if (currentRefresh !== initialRefresh) {
    const access = getAccessToken();
    // A normal cross-tab refresh keeps the JWT subject. A login into a
    // different account also replaces the refresh token, but replaying the
    // original request with that account's access token would mutate/read the
    // wrong account. Fail that one request instead.
    if (currentRefresh && access && initialSubject && accessTokenSubject(access) === initialSubject) {
      return Promise.resolve(access);
    }
    return Promise.reject(
      new ApiError("Аккаунт изменился. Повторите действие.", 409, "session_changed"),
    );
  }
  return exchangeRefreshToken(initialRefresh);
}

async function exchangeRefreshToken(refresh: string): Promise<string> {
  try {
    const data = await rawRequest<{ tokens: AuthTokens }>(
      "/auth/refresh",
      { method: "POST", body: { refresh_token: refresh } },
      null,
    );
    if (getRefreshToken() !== refresh) {
      // Login/logout may have replaced the session while this network request
      // was in flight. Never resurrect or overwrite that newer account.
      throw new ApiError("Сессия изменилась. Повторите действие.", 409, "session_changed");
    }
    setTokens(data.tokens);
    return data.tokens.access_token;
  } catch (e) {
    // Only a genuine auth rejection (401) means the refresh token is dead — clear
    // it so the guard sends the user back to login. Transient failures (5xx, 429,
    // rate limit, network/status 0) must NOT wipe a still-valid session, otherwise
    // a hiccup on a public page silently logs the user out.
    if (e instanceof ApiError && e.status === 401 && getRefreshToken() === refresh) clearTokens();
    throw e;
  }
}

function accessTokenSubject(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded)) as { sub?: unknown };
    return typeof claims.sub === "string" && claims.sub !== "" ? claims.sub : null;
  } catch {
    return null;
  }
}

/**
 * Authenticated request. Unwraps `data`, throws `ApiError`, and on a 401 tries a
 * single token refresh + retry before giving up.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const withAuth = options.auth ?? true;
  const token = withAuth ? getAccessToken() : null;

  try {
    return await rawRequest<T>(path, options, token);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || !withAuth || !getRefreshToken()) {
      throw e;
    }
    const fresh = await refreshAccessToken();
    return rawRequest<T>(path, options, fresh);
  }
}

/**
 * Authenticated request that returns the complete success envelope. Use this
 * when top-level response metadata is part of the UI contract.
 */
export async function apiFetchEnvelope<T, M = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T, M>> {
  const withAuth = options.auth ?? true;
  const token = withAuth ? getAccessToken() : null;

  try {
    return await rawEnvelopeRequest<T, M>(path, options, token);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || !withAuth || !getRefreshToken()) {
      throw e;
    }
    const fresh = await refreshAccessToken();
    return rawEnvelopeRequest<T, M>(path, options, fresh);
  }
}
