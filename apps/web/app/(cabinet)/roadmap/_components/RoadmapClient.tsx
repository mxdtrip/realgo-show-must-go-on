"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getRoadmap, type RoadmapResponse, type RoadmapWeek } from "../../../_api/roadmap";
import { ApiError } from "../../../_api/types";
import { readRoadmap, type RoadmapWeek as PersonalRoadmapWeek } from "../../../_profile/roadmapGenerator";
import { CabinetPanel, ProgressBar } from "../../_components";
import { CabinetIcon } from "../../_icons";

type LoadState = "loading" | "loaded" | "error";

type RoadmapCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  panelEyebrow: string;
  panelTitle: string;
  overallLabel: string;
  nowLabel: string;
  statusDone: string;
  statusActive: string;
  statusTodo: string;
  practiceEyebrow: string;
  practiceCta: string;
  practiceAction: string;
  lockedEyebrow: string;
  lockedTitle: string;
  empty: string;
  loading: string;
  errorTitle: string;
  retry: string;
  personalizedTitle?: string;
  personalizedDescription?: string;
  personalizedPanelTitle?: string;
  personalizedHintCompany?: string;
  personalizedHintWeeks?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateAction?: string;
  subpatternsLabel?: string;
  practiceMeta?: string;
}>;

function interviewCountdown(interviewDate: string | null): string | null {
  if (!interviewDate) return null;
  const date = new Date(`${interviewDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days < 0) return null;
  return `interview T−${days}d`;
}

function mapPersonalWeek(week: PersonalRoadmapWeek): RoadmapWeek {
  return {
    id: week.id,
    label: week.week,
    title: week.title,
    progress: week.progress,
    focus: week.focus,
    status: week.status,
    topics: week.items.map((item) => item.code),
  };
}

/** Роадмап на живых данных GET /me/roadmap: недели = семьи паттернов Pattern
    Atlas, прогресс — реальная mastery-статистика по решённым задачам; неделя
    заблокирована, пока предыдущие не пройдены. Пустой стейт с CTA на
    онбординг показывается, если пользователь ещё не задавал цель подготовки. */
export function RoadmapClient({ copy }: Readonly<{ copy: RoadmapCopy }>) {
  const [data, setData] = useState<RoadmapResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [personal, setPersonal] = useState<{
    weeks: RoadmapWeek[];
    targetCompany: string;
  } | null>(null);

  useEffect(() => {
    const stored = readRoadmap();
    if (stored && stored.weeks.length > 0) {
      setPersonal({
        weeks: stored.weeks.map(mapPersonalWeek),
        targetCompany: stored.targetCompany,
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    setError("");

    getRoadmap(controller.signal)
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

  const statuses: Record<string, string> = {
    done: copy.statusDone,
    active: copy.statusActive,
    todo: copy.statusTodo,
  };

  const weeks = data?.weeks ?? [];
  const isWeekLocked = (index: number) =>
    weeks.slice(0, index).some((previousWeek) => previousWeek.status !== "done");
  const progressOf = (week: RoadmapWeek, index: number) =>
    isWeekLocked(index) ? 0 : week.progress;

  const overall = data?.overallProgress ?? 0;
  const countdown = interviewCountdown(data?.target.interviewDate ?? null);
  const firstActive = weeks.findIndex((week, index) => week.status === "active" && !isWeekLocked(index));

  // GET /me/roadmap always returns one week per pattern family (the fixed
  // global taxonomy) — weeks is never actually empty, even for users who
  // skipped onboarding. The real "hasn't built a roadmap" signal is whether
  // onboarding set a target, not whether the week list is non-empty.
  const isPersonalizedTarget = Boolean(data?.target.company || data?.target.interviewDate);

  // Fallback: показываем персональный план, если backend пустой или ошибся
  const showPersonalFallback =
    personal !== null &&
    (loadState === "error" || (loadState === "loaded" && weeks.length === 0));
  const personalWeeks = showPersonalFallback && personal ? personal.weeks : [];
  const personalOverall =
    personalWeeks.length > 0
      ? Math.round(personalWeeks.reduce((sum, w) => sum + w.progress, 0) / personalWeeks.length)
      : 0;
  const personalFirstActive = personalWeeks.findIndex((w) => w.status === "active");
  const isPersonalLocked = (index: number) =>
    personalWeeks.slice(0, index).some((w) => w.status !== "done");

  const renderWeek = (week: RoadmapWeek, index: number, locked: boolean, activeIndex: number) => {
    const stateName = week.status in statuses ? week.status : "todo";
    const isLocked = locked;
    const visibleProgress = isLocked ? 0 : week.progress;
    const practiceCode = week.topics[0];
    return (
      <li className={`roadmap-step roadmap-step--${stateName}`} key={week.id}>
        <div className="roadmap-step__rail">
          <span className="roadmap-step__node">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <div className="roadmap-step__body">
          <div className="roadmap-step__main">
            <div className="roadmap-step__head">
              <span className="roadmap-step__week">{week.label}</span>
              <span className="roadmap-step__state">{statuses[stateName]}</span>
              {index === activeIndex ? (
                <span className="roadmap-step__now">{copy.nowLabel}</span>
              ) : null}
            </div>
            <h2>{week.title}</h2>
            <p>{week.focus}</p>
            <div className="roadmap-step__progress">
              <ProgressBar value={visibleProgress} label={`${week.title} progress`} />
              <strong>{visibleProgress}%</strong>
            </div>
          </div>
          {isLocked || !practiceCode ? (
            <div className="roadmap-step__practice-card roadmap-step__practice-card--locked">
              <span className="roadmap-step__practice-eyebrow">{copy.lockedEyebrow}</span>
              <strong>{copy.lockedTitle}</strong>
            </div>
          ) : (
            <Link
              className="roadmap-step__practice-card"
              href={`/patterns/${practiceCode}/session`}
            >
              <span className="roadmap-step__practice-eyebrow">{copy.practiceEyebrow}</span>
              <strong>{copy.practiceCta}</strong>
              <em>
                {copy.practiceAction}
                <CabinetIcon name="arrow" />
              </em>
            </Link>
          )}
        </div>
      </li>
    );
  };

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{copy.eyebrow}</span>
          <h1>{showPersonalFallback && copy.personalizedTitle ? copy.personalizedTitle : copy.title}</h1>
          <p>
            {showPersonalFallback && copy.personalizedDescription
              ? copy.personalizedDescription
              : copy.description}
          </p>
        </div>
        {showPersonalFallback ? (
          <div className="cabinet-page-head__actions">
            {personal && personal.targetCompany ? (
              <span className="cabinet-next-hint">
                {copy.personalizedHintCompany ?? "фокус"} · <em>{personal.targetCompany}</em>
              </span>
            ) : null}
            <span className="cabinet-next-hint">
              <em>{personalWeeks.length}</em> {copy.personalizedHintWeeks ?? "недель"}
            </span>
            <span className="cabinet-next-hint">
              <em>{personalOverall}%</em> {copy.overallLabel}
            </span>
          </div>
        ) : loadState === "loaded" && isPersonalizedTarget ? (
          <div className="cabinet-page-head__actions">
            {countdown ? <span className="cabinet-next-hint">{countdown}</span> : null}
            <span className="cabinet-next-hint">
              <em>{overall}%</em> {copy.overallLabel}
            </span>
          </div>
        ) : null}
      </section>

      {!showPersonalFallback && loadState === "loaded" && !isPersonalizedTarget && !personal ? (
        <div className="cabinet-banner" role="status">
          <span>{copy.emptyStateDescription ?? copy.empty}</span>
          <Link className="cabinet-ghost-link" href="/onboarding/profile?force=1">
            {copy.emptyStateAction ?? "построить roadmap"}
            <CabinetIcon name="arrow" />
          </Link>
        </div>
      ) : null}

      {loadState === "loading" ? (
        <CabinetPanel title={copy.loading} padded>
          <p role="status" aria-live="polite">
            {copy.loading}
          </p>
        </CabinetPanel>
      ) : null}

      {loadState === "error" && !showPersonalFallback ? (
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

      {showPersonalFallback ? (
        <CabinetPanel
          eyebrow={copy.panelEyebrow}
          title={copy.personalizedPanelTitle ?? copy.panelTitle}
          meta={
            <span className="cabinet-panel__meta">
              {personalOverall}% {copy.overallLabel}
            </span>
          }
        >
          <ol className="roadmap-track">
            {personalWeeks.map((week, index) =>
              renderWeek(week, index, isPersonalLocked(index), personalFirstActive),
            )}
          </ol>
        </CabinetPanel>
      ) : loadState === "loaded" && isPersonalizedTarget ? (
        <CabinetPanel
          eyebrow={copy.panelEyebrow}
          title={copy.panelTitle}
          meta={
            <span className="cabinet-panel__meta">
              {overall}% {copy.overallLabel}
            </span>
          }
        >
          {weeks.length === 0 ? (
            <div className="data-table__empty">{copy.empty}</div>
          ) : (
            <ol className="roadmap-track">
              {weeks.map((week, index) => renderWeek(week, index, isWeekLocked(index), firstActive))}
            </ol>
          )}
        </CabinetPanel>
      ) : null}
    </main>
  );
}
