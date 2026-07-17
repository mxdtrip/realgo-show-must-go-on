"use client";

import { getAtlas } from "../_api/atlas";
import { ApiError } from "../_api/types";

// Горизонт больше не выбирается вручную — он считается из даты интервью
// (шаг "date" идёт прямо перед "roadmap"), поэтому отдельного шага/пресетов
// длительности нет. Дефолт на случай, если дату пропустили.
export const DEFAULT_ROADMAP_WEEKS = 4;

export function weeksUntil(interviewDateIso: string | null, today = new Date()): number {
  if (!interviewDateIso) return DEFAULT_ROADMAP_WEEKS;
  const target = new Date(`${interviewDateIso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return DEFAULT_ROADMAP_WEEKS;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(target) - startOfDay(today)) / 86_400_000);
  return Math.max(1, Math.ceil(days / 7));
}

export type RoadmapSubpattern = {
  name: string;
  code: string;
};

export type RoadmapWeek = {
  id: string;
  week: string;
  title: string;
  status: "done" | "active" | "todo";
  progress: number;
  focus: string;
  items: RoadmapSubpattern[];
};

// "company" — под реально релевантные компании субпаттерны из атласа;
// "none" — компанию пропустили, строить план не из чего.
export type RoadmapSource = "company" | "none";

export type RoadmapConfig = {
  weeksCount: number;
  targetCompany: string;
  /** Stable Atlas/company code; optional for previously stored configs. */
  targetCompanyCode?: string;
};

export type RoadmapResult = {
  source: RoadmapSource;
  weeks: readonly RoadmapWeek[];
};

export type StoredRoadmap = {
  weeksCount: number;
  targetCompany: string;
  targetCompanyCode?: string;
  source: RoadmapSource;
  weeks: readonly RoadmapWeek[];
  generatedAt: string;
};

export const roadmapStorageKey = "realgo:personal-roadmap:v1";

function relevancePriority(level: string | undefined): number {
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return order[level ?? "low"] ?? 3;
}

// Пул под конкретную компанию: реальные релевантные субпаттерны из атласа,
// самые приоритетные и самые слабые — впереди (их берём на первые недели).
async function poolFromCompany(companyCode: string, signal?: AbortSignal): Promise<RoadmapSubpattern[]> {
  let atlas;
  try {
    atlas = await getAtlas(companyCode, signal);
  } catch (error) {
    // The autocomplete catalog is broader than the Atlas evidence dataset.
    // A known company without evidence is a valid empty plan, not a broken
    // onboarding flow. Network/server failures still propagate.
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  }
  return (atlas.subpatterns ?? [])
    .filter((sub) => sub.relevance && ["high", "medium", "low"].includes(sub.relevance.relevance))
    .sort((a, b) => {
      const byLevel = relevancePriority(a.relevance?.relevance) - relevancePriority(b.relevance?.relevance);
      return byLevel !== 0 ? byLevel : a.mastery.percent - b.mastery.percent;
    })
    .map((sub) => ({ name: sub.name, code: sub.code }));
}

// Один и тот же фиксированный пул делится на N недель: чем больше недель,
// тем меньше тем в каждой (а не наоборот, как было в мок-версии). Если
// недель больше, чем тем, лишние недели — явные "review"-недели (пустой items).
function distributeEvenly<T>(pool: readonly T[], weeksCount: number): T[][] {
  const result: T[][] = Array.from({ length: Math.max(0, weeksCount) }, () => []);
  if (pool.length === 0 || weeksCount <= 0) return result;
  const base = Math.floor(pool.length / weeksCount);
  const extra = pool.length % weeksCount;
  let cursor = 0;
  for (let week = 0; week < weeksCount; week++) {
    const count = base + (week < extra ? 1 : 0);
    result[week] = pool.slice(cursor, cursor + count);
    cursor += count;
  }
  return result;
}

function buildWeekTitle(items: readonly RoadmapSubpattern[]): string {
  if (items.length === 0) return "Повторение и mock interview";
  if (items.length === 1) return items[0].name;
  if (items.length === 2) return items.map((item) => item.name).join(", ");
  return `${items[0].name} + ${items.length - 1} тем`;
}

function buildWeekFocus(items: readonly RoadmapSubpattern[], company: string): string {
  const base =
    items.length === 0
      ? "закрепить пройденное и отработать формат интервью"
      : `разобрать: ${items.map((item) => item.name).join(", ")}`;
  return company ? `${base} · фокус под ${company}` : base;
}

export async function generateRoadmap(config: RoadmapConfig, signal?: AbortSignal): Promise<RoadmapResult> {
  const weeksCount = Math.max(1, config.weeksCount);
  const company = config.targetCompany.trim();
  const companyCode = config.targetCompanyCode?.trim() || company;

  let source: RoadmapSource = "none";
  let pool: RoadmapSubpattern[] = [];

  if (companyCode) {
    pool = await poolFromCompany(companyCode, signal);
    if (pool.length > 0) source = "company";
  }

  const chunks = distributeEvenly(pool, weeksCount);
  const weeks: RoadmapWeek[] = chunks.map((items, index) => ({
    id: `week_${String(index + 1).padStart(2, "0")}`,
    week: `week ${String(index + 1).padStart(2, "0")}`,
    title: buildWeekTitle(items),
    status: index === 0 ? "active" : "todo",
    progress: index === 0 ? 5 : 0,
    focus: buildWeekFocus(items, company),
    items,
  }));

  return { source, weeks };
}

export function saveRoadmap(config: RoadmapConfig, result: RoadmapResult): void {
  if (typeof window === "undefined") return;
  const stored: StoredRoadmap = {
    weeksCount: config.weeksCount,
    targetCompany: config.targetCompany,
    targetCompanyCode: config.targetCompanyCode,
    source: result.source,
    weeks: result.weeks,
    generatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(roadmapStorageKey, JSON.stringify(stored));
}

export function readRoadmap(): StoredRoadmap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(roadmapStorageKey);
    if (!raw) return null;
    return JSON.parse(raw) as StoredRoadmap;
  } catch {
    return null;
  }
}
