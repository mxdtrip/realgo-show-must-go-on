"use client";

import { apiFetch } from "./client";
import { clearTokens, getRefreshToken } from "./tokens";
import type { AuthUser } from "./types";

type UserResponse = { user: AuthUser };

export type ProfileUpdate = {
  timezone?: string;
  interview_date?: string;
  prep_goal?: string;
  grade?: string;
  target_company?: string;
  target_position?: string;
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
