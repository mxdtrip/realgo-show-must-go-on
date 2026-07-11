"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getAtlas, type AtlasSubpattern, type MasteryStatus } from "../../../_api/atlas";
import {
  getPractice,
  removePracticeSubpattern,
  type PracticeSubpattern,
} from "../../../_api/practice";
import { ApiError } from "../../../_api/types";
import { useToast } from "../../../_toast";
import { CabinetPanel, ProgressBar, StatusPill } from "../../_components";

type LoadState = "loading" | "loaded" | "error";

/** Стадия подпаттерна в практике: только добавлен → в работе → освоен. */
type PracticeStage = "added" | "working" | "mastered";

type Tone = "default" | "accent" | "success" | "warning" | "danger";

type PracticeCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  panelEyebrow: string;
  panelTitle: string;
  filterAll: string;
  stages: Readonly<Record<PracticeStage, readonly [string, string]>>;
  masteryLabel: string;
  cardsUnit: string;
  dueUnit: string;
  solvedLabel: string;
  addMore: string;
  remove: string;
  removed: string;
  removeFailed: string;
  empty: string;
  emptyAll: string;
  emptyAllCta: string;
  loading: string;
  errorTitle: string;
  retry: string;
}>;

type PracticeRow = {
  code: string;
  name: string;
  addedAt: string;
  stage: PracticeStage;
  masteryPercent: number;
  masteryStatus: MasteryStatus | null;
  solved: number;
  problems: number;
  cards: number;
  due: number;
  familyNames: string[];
};

/** strong/mastered → освоен; любой реальный прогресс → в работе; иначе — только добавлен. */
function stageOf(sub: AtlasSubpattern | undefined): PracticeStage {
  if (!sub) return "added";
  if (sub.mastery.status === "strong" || sub.mastery.status === "mastered") return "mastered";
  if (sub.mastery.status !== "not_started" || sub.stats.attempt_count > 0 || sub.stats.solved_count > 0) {
    return "working";
  }
  return "added";
}

const stageTone: Record<PracticeStage, Tone> = {
  added: "default",
  working: "accent",
  mastered: "success",
};

const stageOrder: readonly PracticeStage[] = ["added", "working", "mastered"];

/** Прогресс практики: какие подпаттерны пользователь взял в работу и где
    каждый находится. Управление набором — здесь и в Атласе. */
export function PracticeProgressClient({ copy }: Readonly<{ copy: PracticeCopy }>) {
  const [rows, setRows] = useState<PracticeRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [stageFilter, setStageFilter] = useState<"all" | PracticeStage>("all");
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const controller = new AbortController();

    setLoadState("loading");
    setError("");

    Promise.all([getPractice(controller.signal), getAtlas(undefined, controller.signal)])
      .then(([practice, atlas]) => {
        const subByCode = new Map(atlas.subpatterns.map((sub) => [sub.code, sub]));
        const familyByCode = new Map(atlas.families.map((family) => [family.code, family.name]));
        const items = practice.subpatterns.map((item: PracticeSubpattern): PracticeRow => {
          const sub = subByCode.get(item.code);
          return {
            code: item.code,
            name: sub?.name ?? item.name,
            addedAt: item.addedAt,
            stage: stageOf(sub),
            masteryPercent: sub?.mastery.percent ?? 0,
            masteryStatus: sub?.mastery.status ?? null,
            solved: sub?.stats.solved_count ?? 0,
            problems: sub?.stats.problem_count ?? 0,
            cards: sub?.stats.card_count ?? 0,
            due: sub?.stats.due_count ?? 0,
            familyNames: (sub?.family_codes ?? [])
              .map((code) => familyByCode.get(code))
              .filter((name): name is string => Boolean(name)),
          };
        });
        setRows(items);
        setLoadState("loaded");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setRows([]);
        setError(e instanceof ApiError ? e.message : copy.errorTitle);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [copy.errorTitle, reloadVersion]);

  const remove = async (row: PracticeRow) => {
    if (busyCode) return;
    setBusyCode(row.code);
    try {
      await removePracticeSubpattern(row.code);
      setRows((current) => current.filter((item) => item.code !== row.code));
      toast.success(`${copy.removed} ${row.name}`);
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : copy.removeFailed);
    } finally {
      setBusyCode(null);
    }
  };

  const visible = useMemo(
    () => (stageFilter === "all" ? rows : rows.filter((row) => row.stage === stageFilter)),
    [rows, stageFilter],
  );

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </section>

      <div className="cabinet-toolbar">
        <div className="filter-tabs">
          <button
            className={stageFilter === "all" ? "is-active" : undefined}
            type="button"
            aria-pressed={stageFilter === "all"}
            onClick={() => setStageFilter("all")}
          >
            {copy.filterAll}
            <em>{rows.length}</em>
          </button>
          {stageOrder.map((stage) => {
            const count = rows.filter((row) => row.stage === stage).length;
            return (
              <button
                className={stageFilter === stage ? "is-active" : undefined}
                key={stage}
                type="button"
                aria-pressed={stageFilter === stage}
                onClick={() => setStageFilter(stage)}
              >
                {copy.stages[stage][0]}
                <em>{count}</em>
              </button>
            );
          })}
        </div>
        <Link className="cabinet-ghost-link" href="/patterns">
          {copy.addMore}
        </Link>
      </div>

      <CabinetPanel
        eyebrow={copy.panelEyebrow}
        title={copy.panelTitle}
        meta={
          <span className="cabinet-panel__meta">
            {visible.length} / {rows.length}
          </span>
        }
      >
        <div className="practice-list">
          {loadState === "loading" ? (
            <div className="review-list__state" role="status" aria-live="polite">
              {copy.loading}
            </div>
          ) : null}

          {loadState === "error" ? (
            <div className="review-list__state review-list__state--error" role="alert">
              <strong>{copy.errorTitle}</strong>
              {error ? <p>{error}</p> : null}
              <button type="button" onClick={() => setReloadVersion((version) => version + 1)}>
                {copy.retry}
              </button>
            </div>
          ) : null}

          {loadState === "loaded"
            ? visible.map((row) => (
                <article className="practice-item" key={row.code}>
                  <div className="practice-item__main">
                    <div className="practice-item__title-row">
                      <Link className="practice-item__name" href={`/patterns/${row.code}`}>
                        {row.name}
                      </Link>
                      <StatusPill tone={stageTone[row.stage]}>{copy.stages[row.stage][0]}</StatusPill>
                    </div>
                    {row.familyNames.length > 0 ? (
                      <p className="practice-item__families">{row.familyNames.join(", ")}</p>
                    ) : null}
                    <div className="practice-item__progress">
                      <ProgressBar
                        value={row.masteryPercent}
                        label={`${row.name} ${copy.masteryLabel}`}
                        tone={row.masteryPercent < 45 ? "danger" : row.masteryPercent < 60 ? "warning" : "default"}
                      />
                      <em>{row.masteryPercent}%</em>
                    </div>
                  </div>
                  <div className="practice-item__side">
                    <span className="practice-item__stats">
                      {copy.solvedLabel} {row.solved}/{row.problems} · {row.cards} {copy.cardsUnit}
                      {row.due > 0 ? ` · ${row.due} ${copy.dueUnit}` : ""}
                    </span>
                    <button
                      className="review-action review-action--ghost"
                      disabled={busyCode !== null}
                      type="button"
                      onClick={() => void remove(row)}
                    >
                      {copy.remove}
                    </button>
                  </div>
                </article>
              ))
            : null}

          {loadState === "loaded" && visible.length === 0 ? (
            <div className="data-table__empty">
              {rows.length === 0 ? (
                <>
                  {copy.emptyAll}{" "}
                  <Link className="problem-cell__pattern" href="/patterns">
                    {copy.emptyAllCta}
                  </Link>
                </>
              ) : (
                copy.empty
              )}
            </div>
          ) : null}
        </div>
      </CabinetPanel>
    </main>
  );
}
