"use client";

// Статус браузерного расширения: платформы с последней синхронизацией и
// лента последних событий. Зеркалит services/api/internal/extension/status_models.go.

import { apiFetch } from "./client";

export type ExtensionPlatformStatus = {
  source: string;
  status: string;
  lastSyncAt: string;
};

export type ExtensionRecentEvent = {
  id: string;
  source: string;
  event: "problem_solved" | "problem_submitted" | "problem_viewed" | "rating_changed" | string;
  title: string;
  occurredAt: string;
};

export type ExtensionStatusResponse = {
  connected: boolean;
  platforms: ExtensionPlatformStatus[];
  recentEvents: ExtensionRecentEvent[];
};

export function getExtensionStatus(signal?: AbortSignal) {
  return apiFetch<ExtensionStatusResponse>("/me/extension/status", { signal });
}
