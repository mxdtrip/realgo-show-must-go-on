"use client";

// Роадмап подготовки: недели по паттернам NeetCode 150 с живым прогрессом.
// Зеркалит services/api/internal/roadmap/models.go.

import { apiFetch } from "./client";

export type RoadmapTarget = {
  company: string | null;
  interviewDate: string | null;
};

export type RoadmapWeek = {
  id: string;
  label: string;
  title: string;
  progress: number;
  focus: string;
  status: "done" | "active" | "todo" | string;
  /** Коды паттернов недели — практика ведёт на /patterns/{code}/session. */
  topics: string[];
};

export type RoadmapProblem = {
  id: number;
  externalId?: string;
  slug: string;
  title: string;
  url: string;
  difficulty: string;
  status: string;
  rating?: string;
  confidence?: number;
  position: number;
};

export type RoadmapPattern = {
  id: string;
  code: string;
  name: string;
  totalProblems: number;
  solvedProblems: number;
  inProgressProblems: number;
  progress: number;
  problems: RoadmapProblem[];
};

export type RoadmapResponse = {
  overallProgress: number;
  target: RoadmapTarget;
  weeks: RoadmapWeek[];
  patterns: RoadmapPattern[];
};

export function getRoadmap(signal?: AbortSignal) {
  return apiFetch<RoadmapResponse>("/me/roadmap", { signal });
}
