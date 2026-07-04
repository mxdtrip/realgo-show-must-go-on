"use client";

// Typed fetch wrapper around the Go API: attaches the Bearer token, unwraps the
// { data } / { error } envelope, and transparently refreshes the access token
// once on a 401 before retrying the original request.

import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokens";
import { ApiError, type ApiEnvelope, type ApiErrorBody, type AuthTokens } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8080";

const API_PREFIX = "/api/v1";

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

  return payload as ApiEnvelope<T, M>;
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
  const refresh = getRefreshToken();
  if (!refresh) {
    throw new ApiError("Сессия не найдена. Войдите в аккаунт.", 401, "no_session");
  }
  try {
    const data = await rawRequest<{ tokens: AuthTokens }>(
      "/auth/refresh",
      { method: "POST", body: { refresh_token: refresh } },
      null,
    );
    setTokens(data.tokens);
    return data.tokens.access_token;
  } catch (e) {
    // Only a genuine auth rejection (401) means the refresh token is dead — clear
    // it so the guard sends the user back to login. Transient failures (5xx, 429,
    // rate limit, network/status 0) must NOT wipe a still-valid session, otherwise
    // a hiccup on a public page silently logs the user out.
    if (e instanceof ApiError && e.status === 401) clearTokens();
    throw e;
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
