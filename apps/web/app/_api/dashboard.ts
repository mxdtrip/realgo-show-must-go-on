"use client";

// Дашборд кабинета: KPI-статы (очередь/решено/streak/readiness), превью
// очереди повторений, слабые паттерны и per-day активность для хитмапа.
// Зеркалит services/api/internal/dashboard/models.go.

import { apiFetch } from "./client";

export type DashboardStatKey = "today_queue" | "solved_total" | "streak" | "readiness" | string;
export type DashboardTone = "default" | "accent" | "success" | "warning" | "danger";

export type DashboardStat = {
  key: DashboardStatKey;
  label: string;
  value: number;
  displayValue: string;
  hint: string;
  tone: DashboardTone;
};

export type DashboardNextAction = {
  type: string;
  title: string;
  description: string;
  href: string;
  dueAt?: string;
};

export type DashboardReviewItem = {
  id: string;
  type: "problem_review" | "card_review" | "pattern_review" | string;
  title: string;
  meta: string;
  dueAt: string;
  lastRating: "hard" | "normal" | "easy" | null;
};

export type DashboardWeakPattern = {
  id: string;
  name: string;
  confidence: number;
  signal: string;
};

export type DashboardActivityDay = {
  /** YYYY-MM-DD в таймзоне пользователя. */
  date: string;
  count: number;
};

export type DashboardActivity = {
  /** Только активные дни за окно хитмапа (56 дней), старые первыми. */
  days: DashboardActivityDay[];
  activeDays: number;
  totalReviews: number;
};

export type DashboardResponse = {
  nextAction: DashboardNextAction;
  stats: DashboardStat[];
  reviewPreview: DashboardReviewItem[];
  weakPatterns: DashboardWeakPattern[];
  activity: DashboardActivity;
};

export function getDashboard(signal?: AbortSignal) {
  return apiFetch<DashboardResponse>("/me/dashboard", { signal });
}
