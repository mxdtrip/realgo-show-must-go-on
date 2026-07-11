"use client";

// Личная база задач: GET /me/problems (journal of everything the extension
// captured plus manually saved problems). Mirrors services/api/internal/problems.

import { apiFetchEnvelope } from "./client";

export type ProblemStatus = "saved" | "reviewing" | "mastered" | "archived";
export type ProblemPlatform = "leetcode" | "neetcode" | "codeforces" | "custom";

export type ProblemPattern = {
  /** Pattern code (e.g. "sliding_window") — doubles as the Atlas node id. */
  id: string;
  name: string;
} | null;

export type ProblemListItem = {
  id: number;
  externalId: string;
  title: string;
  url: string;
  platform: ProblemPlatform | string;
  difficulty: "easy" | "medium" | "hard" | "unknown" | string;
  pattern: ProblemPattern;
  status: ProblemStatus | string;
  nextReviewAt: string | null;
  lastRating: "hard" | "normal" | "easy" | string | null;
  solvedAt: string | null;
  /** Сколько подсказок ассистента реально выдано по задаче. */
  hintsUsed: number;
  createdAt: string;
  updatedAt: string;
};

export type ProblemsMeta = {
  nextCursor: string | null;
};

export type GetProblemsParams = {
  status?: ProblemStatus;
  platform?: ProblemPlatform;
  limit?: number;
  cursor?: string;
};

export function getProblems(params: GetProblemsParams = {}, signal?: AbortSignal) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.platform) query.set("platform", params.platform);
  query.set("limit", String(params.limit ?? 100));
  if (params.cursor) query.set("cursor", params.cursor);
  return apiFetchEnvelope<ProblemListItem[], ProblemsMeta>(`/me/problems?${query}`, { signal });
}
