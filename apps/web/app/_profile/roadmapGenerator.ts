"use client";

// Compatibility reader for roadmap plans produced before server-side roadmap
// configs shipped. RoadmapClient imports an existing v1 snapshot once, commits
// an equivalent balanced plan through PUT /me/roadmap and removes this key.

export type LegacyRoadmapSubpattern = {
  name: string;
  code: string;
};

export type LegacyRoadmapWeek = {
  id: string;
  week: string;
  title: string;
  status: "done" | "active" | "todo";
  progress: number;
  focus: string;
  items: LegacyRoadmapSubpattern[];
};

export type StoredRoadmap = {
  weeksCount: number;
  targetCompany: string;
  targetCompanyCode?: string;
  source: "company" | "none";
  weeks: readonly LegacyRoadmapWeek[];
  generatedAt: string;
};

export const roadmapStorageKey = "realgo:personal-roadmap:v1";

export function readRoadmap(): StoredRoadmap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(roadmapStorageKey);
    return raw ? (JSON.parse(raw) as StoredRoadmap) : null;
  } catch {
    return null;
  }
}

export function clearRoadmap(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(roadmapStorageKey);
}
