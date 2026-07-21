"use client";

import { apiFetch } from "./client";

export type RoadmapPriorityMode =
  | "balanced"
  | "easy_first"
  | "company_frequency"
  | "knowledge_gaps";

export type RoadmapTargetCompany = {
  code: string | null;
  name: string;
};

export type RoadmapTarget = {
  company: RoadmapTargetCompany | null;
  interviewDate: string | null;
  topics: string[];
};

export type RoadmapItem = {
  code: string;
  name: string;
  relevantProblemCount: number;
  difficultyCounts: Record<string, number>;
  masteryPercent: number;
};

export type RoadmapWeek = {
  id: string;
  label: string;
  title: string;
  progress: number;
  focus: string;
  status: "done" | "active" | "todo" | string;
  topics: string[];
  items: RoadmapItem[];
};

export type RoadmapResponse = {
  overallProgress: number;
  target: RoadmapTarget;
  priorityMode: RoadmapPriorityMode;
  availableModes: RoadmapPriorityMode[];
  algorithmVersion: number;
  source: "company" | "core";
  horizonWeeks: number;
  weeklyCapacity: number;
  selectedCount: number;
  reserveCount: number;
  configured: boolean;
  generatedAt?: string;
  weeks: RoadmapWeek[];
};

export type RoadmapConfig = {
  companyCode: string;
  companyName: string;
  interviewDate: string | null;
  priorityMode: RoadmapPriorityMode;
  preserveProgress?: boolean;
};

export function getRoadmap(signal?: AbortSignal) {
  return apiFetch<RoadmapResponse>("/me/roadmap", { signal });
}

export function previewRoadmap(config: RoadmapConfig, signal?: AbortSignal) {
  return apiFetch<RoadmapResponse>("/me/roadmap/preview", {
    method: "POST",
    body: config,
    signal,
  });
}

export function saveRoadmap(config: RoadmapConfig, signal?: AbortSignal) {
  return apiFetch<RoadmapResponse>("/me/roadmap", {
    method: "PUT",
    body: config,
    signal,
  });
}

export function deleteRoadmap(signal?: AbortSignal) {
  return apiFetch<void>("/me/roadmap", { method: "DELETE", signal });
}
