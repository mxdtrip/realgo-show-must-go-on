"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getDashboard,
  type DashboardActivityDay,
  type DashboardResponse,
  type DashboardStat,
} from "../../../_api/dashboard";
import { ApiError } from "../../../_api/types";
import {
  ActivityHeatmap,
  CabinetPanel,
  MetricCard,
  ProgressBar,
  type MetricTone,
} from "../../_components";
import type { HeatmapTooltipCopy } from "../../_components";
import { PracticeLauncher, type PracticeLauncherCopy } from "./PracticeLauncher";

type LoadState = "loading" | "loaded" | "error";

type DashboardCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  queueTitle: string;
  queueEmpty: string;
  patternsTitle: string;
  patternsEmpty: string;
  loading: string;
  errorTitle: string;
  retry: string;
  viewAll: string;
  dayToday: string;
  dayTomorrow: string;
  statTooltips: Readonly<Record<string, string>>;
  launcher: PracticeLauncherCopy;
  heatmap: Readonly<{
    title: string;
    aria: string;
    foot: string;
    scaleLess: string;
    scaleMore: string;
    tooltip: HeatmapTooltipCopy;
    statDays: string;
    statReviews: string;
    statStreak: string;
  }>;
  /** [key, label, tone] из pages.reviews.types — тона точек в очереди. */
  reviewTypes: readonly (readonly [string, string, string])[];
}>;

/* -- Heatmap: dense 56-day grid out of the sparse per-day API counts ------ */

const HEATMAP_DAYS = 56;
const HEATMAP_COLUMNS = 14;

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Раскладывает разреженные активные дни в 4 ряда × 14 колонок (сегодня —
    последняя ячейка), уровни 0–4 нормируются на максимум окна. */
function buildHeatmap(days: readonly DashboardActivityDay[]) {
  const byDate = new Map(days.map((day) => [day.date, day.count]));
  const now = new Date();
  const flat: number[] = [];
  for (let ago = HEATMAP_DAYS - 1; ago >= 0; ago--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago);
    flat.push(byDate.get(localDateKey(date)) ?? 0);
  }

  const max = Math.max(1, ...flat);
  const weeks: number[][] = [];
  const counts: number[][] = [];
  for (let start = 0; start < flat.length; start += HEATMAP_COLUMNS) {
    const chunk = flat.slice(start, start + HEATMAP_COLUMNS);
    counts.push(chunk);
    weeks.push(chunk.map((count) => (count > 0 ? Math.min(4, Math.ceil((count / max) * 4)) : 0)));
  }
  return { weeks, counts };
}

/* -- Stats: icon + tone mapping for backend stat keys ---------------------- */

const statIcons: Record<string, string> = {
  today_queue: "queue",
  solved_total: "problems",
  streak: "streak",
  readiness: "readiness",
};

function metricTone(stat: DashboardStat): MetricTone {
  switch (stat.tone) {
    case "accent":
    case "success":
    case "warning":
      return stat.tone;
    case "danger":
      return "warning";
    default:
      return "default";
  }
}

/* -- Review preview: dueAt → «сегодня · 09:30» ----------------------------- */

const dueTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});
const dueDateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

function formatDue(value: string, copy: DashboardCopy): { day: string; time: string } {
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return { day: "", time: "" };
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
  const day =
    diffDays <= 0 ? copy.dayToday : diffDays === 1 ? copy.dayTomorrow : dueDateFormatter.format(due).replace(".", "");
  return { day, time: dueTimeFormatter.format(due) };
}

function confidenceTone(value: number) {
  if (value < 45) return "danger";
  if (value < 60) return "warning";
  return "accent";
}

/** Дашборд на живых данных GET /me/dashboard: KPI, хитмап активности,
    превью очереди повторений и слабые паттерны. */
export function DashboardClient({ copy }: Readonly<{ copy: DashboardCopy }>) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    setError("");

    getDashboard(controller.signal)
      .then((response) => {
        setData(response);
        setLoadState("loaded");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(e instanceof ApiError ? e.message : copy.errorTitle);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [copy.errorTitle, reloadVersion]);

  const streak = data?.stats.find((stat) => stat.key === "streak");
  const heatmap = data ? buildHeatmap(data.activity.days) : null;
  const typeTones = new Map(copy.reviewTypes.map(([key, , tone]) => [key, tone]));

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </section>

      {loadState === "loading" ? (
        <CabinetPanel title={copy.loading} padded>
          <p role="status" aria-live="polite">
            {copy.loading}
          </p>
        </CabinetPanel>
      ) : null}

      {loadState === "error" ? (
        <CabinetPanel title={copy.errorTitle} padded>
          <p role="alert">{error || copy.errorTitle}</p>
          <button
            className="review-action review-action--ghost"
            type="button"
            onClick={() => setReloadVersion((version) => version + 1)}
          >
            {copy.retry}
          </button>
        </CabinetPanel>
      ) : null}

      {loadState === "loaded" && data && heatmap ? (
        <>
          <CabinetPanel title={copy.heatmap.title}>
            <div className="heatmap-layout">
              <div>
                <ActivityHeatmap
                  weeks={heatmap.weeks}
                  counts={heatmap.counts}
                  tooltip={copy.heatmap.tooltip}
                  ariaLabel={copy.heatmap.aria}
                  footLeft={copy.heatmap.foot}
                  scaleLess={copy.heatmap.scaleLess}
                  scaleMore={copy.heatmap.scaleMore}
                />
              </div>
              <div className="heatmap-stats">
                <div>
                  <strong>{data.activity.activeDays}</strong>
                  <span>{copy.heatmap.statDays}</span>
                </div>
                <div>
                  <strong>{data.activity.totalReviews}</strong>
                  <span>{copy.heatmap.statReviews}</span>
                </div>
                <div>
                  <strong>{streak?.displayValue ?? "0"}</strong>
                  <span>{copy.heatmap.statStreak}</span>
                </div>
              </div>
              <PracticeLauncher copy={copy.launcher} />
            </div>
          </CabinetPanel>

          <section className="metric-grid">
            {data.stats.map((stat) => (
              <MetricCard
                key={stat.key}
                label={stat.label}
                value={stat.displayValue}
                hint={stat.hint}
                tone={metricTone(stat)}
                icon={statIcons[stat.key]}
                tooltip={copy.statTooltips[stat.key]}
              />
            ))}
          </section>

          <div className="cabinet-grid">
            <CabinetPanel
              title={copy.queueTitle}
              meta={
                <Link className="cabinet-panel__meta" href="/reviews">
                  {copy.viewAll}
                </Link>
              }
            >
              <div className="review-list">
                {data.reviewPreview.map((item) => {
                  const due = formatDue(item.dueAt, copy);
                  const tone = typeTones.get(item.type.replace(/_review$/, "")) ?? "accent";
                  return (
                    <article className="review-list__item" key={item.id}>
                      <div className="review-list__main">
                        <div className="review-list__title-row">
                          <span className={`review-type review-type--${tone}`} aria-hidden="true" />
                          <strong>{item.title}</strong>
                        </div>
                        <p>{item.meta}</p>
                      </div>
                      <div className="review-list__side">
                        <span className="review-when">
                          <em>{due.day} · </em>
                          {due.time}
                        </span>
                      </div>
                    </article>
                  );
                })}
                {data.reviewPreview.length === 0 ? (
                  <div className="data-table__empty">{copy.queueEmpty}</div>
                ) : null}
              </div>
            </CabinetPanel>

            <CabinetPanel
              title={copy.patternsTitle}
              meta={
                <Link className="cabinet-panel__meta" href="/patterns">
                  {copy.viewAll}
                </Link>
              }
            >
              <div className="pattern-stack">
                {data.weakPatterns.map((pattern) => (
                  <article key={pattern.id}>
                    <div>
                      <strong>{pattern.name}</strong>
                      <span className={`confidence--${confidenceTone(pattern.confidence)}`}>
                        {pattern.confidence}%
                      </span>
                    </div>
                    <ProgressBar
                      value={pattern.confidence}
                      tone={
                        pattern.confidence < 45
                          ? "danger"
                          : pattern.confidence < 60
                            ? "warning"
                            : "default"
                      }
                      label={`${pattern.name} confidence`}
                    />
                    <p>{pattern.signal}</p>
                  </article>
                ))}
                {data.weakPatterns.length === 0 ? (
                  <div className="data-table__empty">{copy.patternsEmpty}</div>
                ) : null}
              </div>
            </CabinetPanel>
          </div>
        </>
      ) : null}
    </main>
  );
}
