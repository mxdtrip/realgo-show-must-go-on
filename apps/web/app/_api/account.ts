"use client";

import { apiFetch } from "./client";
import { clearTokens, getRefreshToken } from "./tokens";
import { ApiError, type AuthUser } from "./types";

type UserResponse = { user: AuthUser };

export type ProfileUpdate = {
  timezone?: string;
  interview_date?: string;
  prep_goal?: string;
  grade?: string;
  target_company?: string;
  target_position?: string;
  platform?: string;
  onboarding_completed?: boolean;
};

export type NotificationSettingsUpdate = {
  review_reminder?: boolean;
  weekly_digest?: boolean;
  email_enabled?: boolean;
};

export type ExportResponse = {
  status: string;
  message: string;
};

export async function updateProfile(update: ProfileUpdate): Promise<AuthUser> {
  const data = await apiFetch<UserResponse>("/me/profile", {
    method: "PATCH",
    body: update,
  });
  return data.user;
}

export async function updateNotificationSettings(
  update: NotificationSettingsUpdate,
): Promise<AuthUser> {
  const data = await apiFetch<UserResponse>("/me/notification-settings", {
    method: "PATCH",
    body: update,
  });
  return data.user;
}

export function requestDataExport(): Promise<ExportResponse> {
  return apiFetch<ExportResponse>("/me/export", { method: "POST" });
}

export async function deleteAccount(password: string): Promise<void> {
  await apiFetch<{ status: string }>("/me", {
    method: "DELETE",
    body: {
      password,
      refresh_token: getRefreshToken() ?? "",
    },
  });
  clearTokens();
}

/**
 * POST /me/password — change the current user's password.
 *
 * Older rolling-deploy backends may still answer 404/405; the settings UI
 * keeps its compatibility message for that case.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch<{ status: string }>("/me/password", {
    method: "POST",
    body: {
      current_password: currentPassword,
      new_password: newPassword,
    },
  });
}

/**
 * POST /me/sessions/revoke — revoke all other sessions for the current user.
 *
 * On an older rolling-deploy backend, 404/405 falls back to clearing the local
 * session so the user is at least logged out of this device.
 * Returns true if the server confirmed revocation, false if it was a local
 * fallback (endpoint unavailable).
 */
export async function revokeAllSessions(): Promise<boolean> {
  try {
    await apiFetch<{ status: string }>("/me/sessions/revoke", {
      method: "POST",
    });
    return true;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      clearTokens();
      return false;
    }
    throw e;
  }
}
