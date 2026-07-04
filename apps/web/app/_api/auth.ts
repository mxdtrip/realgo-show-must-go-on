"use client";

// Auth endpoint wrappers. The backend uses DisallowUnknownFields, so each call
// sends exactly the fields the handler expects — nothing extra.

import { apiFetch } from "./client";
import { clearTokens, getRefreshToken, setTokens } from "./tokens";
import type { AuthTokens, AuthUser } from "./types";

type AuthResponse = { user: AuthUser; tokens: AuthTokens };

/** POST /auth/register → creates the account and starts a session. */
export async function register(email: string, password: string): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
  setTokens(data.tokens);
  return data.user;
}

/** POST /auth/login → authenticates and starts a session. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
  setTokens(data.tokens);
  return data.user;
}

/** GET /users/me → the current authenticated user. */
export async function getMe(): Promise<AuthUser> {
  const data = await apiFetch<{ user: AuthUser }>("/users/me");
  return data.user;
}

/** POST /auth/logout → best-effort refresh-token revocation, then clears state. */
export async function logout(): Promise<void> {
  const refresh = getRefreshToken();
  if (refresh) {
    try {
      await apiFetch<{ status: string }>("/auth/logout", {
        method: "POST",
        auth: false,
        body: { refresh_token: refresh },
      });
    } catch {
      // A failed revocation must not block local logout.
    }
  }
  clearTokens();
}
