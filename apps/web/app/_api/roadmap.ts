"use client";

// Роадмап подготовки: недели = семьи паттернов Pattern Atlas, прогресс живой
// (тот же источник, что и у /patterns). Зеркалит services/api/internal/roadmap/models.go.

import { apiFetch } from "./client";

export type RoadmapTargetCompany = {
  code: string | null;
  name: string;
};

export type RoadmapTarget = {
  company: RoadmapTargetCompany | null;
  interviewDate: string | null;
  topics: string[];
};

export type RoadmapWeek = {
  id: string;
  label: string;
  title: string;
  progress: number;
  focus: string;
  status: "done" | "active" | "todo" | string;
  /** Код самого слабого подпаттерна недели — практика ведёт на /patterns/{code}/session. */
  topics: string[];
};

export type RoadmapResponse = {
  overallProgress: number;
  target: RoadmapTarget;
  weeks: RoadmapWeek[];
};

export function getRoadmap(signal?: AbortSignal) {
  return apiFetch<RoadmapResponse>("/me/roadmap", { signal });
}

/** Clears the onboarding-set target (company/interview date/topics) — the
    roadmap goes back to the empty "build your roadmap" state. Solve history
    and progress are untouched. */
export function deleteRoadmap(signal?: AbortSignal) {
  return apiFetch<void>("/me/roadmap", { method: "DELETE", signal });
}
