"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getAtlas,
  getAtlasCompanies,
  type AtlasCompany,
  type AtlasRelevantProblem,
  type AtlasResponse,
  type AtlasSubpattern,
  type RelevanceLevel,
} from "../../../_api/atlas";
import { ApiError } from "../../../_api/types";
import { CabinetPanel } from "../../_components";
import type { getDictionary } from "../../../_content/i18n";
import { platformOptions, type PlatformId } from "../../../_profile/platforms";

type AtlasCopy = ReturnType<typeof getDictionary>["cabinet"]["pages"]["atlas"];

type LoadState = "loading" | "loaded" | "error";
type AtlasView = "tree" | "companies";
type DifficultyLevel = "easy" | "medium" | "hard";
type DifficultyBreakdown = { level: DifficultyLevel; count: number };
type DifficultyCounts = Partial<Record<DifficultyLevel | "unknown", number>>;

const COMPANY_KEY = "realgo.atlas.company";
const VIEW_KEY = "realgo.atlas.view";
const EXPANDED_KEY = "realgo.atlas.expanded";
const PLATFORM_KEY = "realgo.atlas.platform";

function pluralRu(n: number, forms: readonly string[]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* приватный режим — просто не сохраняем */
  }
}

function familyStats(subs: readonly AtlasSubpattern[]) {
  return {
    problemCount: subs.reduce((sum, sub) => sum + sub.stats.problem_count, 0),
    dueCount: subs.reduce((sum, sub) => sum + sub.stats.due_count, 0),
  };
}

// Все три уровня отдаются всегда: сетка .atlas-difficulty-badges держит
// фиксированные колонки easy/medium/hard, а нулевые уровни гасятся классом
// is-zero (visibility: hidden), чтобы колонки не съезжали между строками.
// Пустой список — только когда размеченных задач нет вовсе.
function difficultyBreakdown(counts: DifficultyCounts | undefined): DifficultyBreakdown[] {
  if (!counts) return [];
  const levels = (["easy", "medium", "hard"] as const).map((level) => ({
    level,
    count: counts[level] ?? 0,
  }));
  return levels.some((item) => item.count > 0) ? levels : [];
}

function DifficultyBadges({ levels }: Readonly<{ levels: readonly DifficultyBreakdown[] }>) {
  return (
    <span
      className="atlas-difficulty-badges"
      aria-label={levels
        .filter((item) => item.count > 0)
        .map((item) => `${item.level} ${item.count}`)
        .join(", ")}
    >
      {levels.map(({ level, count }) => (
        <span
          className={`atlas-difficulty-badge atlas-difficulty-badge--${level}${count === 0 ? " is-zero" : ""}`}
          key={level}
        >
          <span>{level}</span>
          {" "}
          <span className="atlas-difficulty-badge__count">{count}</span>
        </span>
      ))}
    </span>
  );
}

function familyDifficulty(subs: readonly AtlasSubpattern[], copy: AtlasCopy) {
  const counts = { easy: 0, medium: 0, hard: 0, unknown: 0 };

  for (const sub of subs) {
    const byDifficulty = sub.stats.difficulty_counts;
    if (!byDifficulty) {
      counts.unknown += sub.stats.problem_count;
      continue;
    }

    for (const key of ["easy", "medium", "hard"] as const) {
      const count = byDifficulty[key] ?? 0;
      counts[key] += count;
    }
    const knownForSub = (byDifficulty.easy ?? 0) + (byDifficulty.medium ?? 0) + (byDifficulty.hard ?? 0);
    counts.unknown += Math.max(0, sub.stats.problem_count - knownForSub);
  }

  const known = counts.easy + counts.medium + counts.hard;
  if (known === 0) {
    return {
      label: copy.familyDifficultyUnknown,
      detail: copy.familyDifficultyNoData,
      levels: [] as DifficultyBreakdown[],
      title: copy.familyDifficultyHint,
      known: false,
    };
  }

  const levels = difficultyBreakdown(counts);

  return {
    label: "",
    detail: "",
    levels,
    title: copy.familyDifficultyHint,
    known: true,
  };
}

export function PatternAtlasClient({ copy }: Readonly<{ copy: AtlasCopy }>) {
  const [atlas, setAtlas] = useState<AtlasResponse | null>(null);
  const [companies, setCompanies] = useState<AtlasCompany[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  const [company, setCompany] = useState<string>("");
  const [platform, setPlatform] = useState<PlatformId | "">("");
  const [view, setView] = useState<AtlasView>("tree");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companyQuery, setCompanyQuery] = useState("");
  const companyDialogRef = useRef<HTMLDivElement>(null);

  // Restore persisted selection before the first fetch.
  useEffect(() => {
    const storedCompany = readStored(COMPANY_KEY) ?? "";
    setCompany(storedCompany);
    setPlatform((readStored(PLATFORM_KEY) as PlatformId | null) ?? "");
    // Companies имеет смысл только относительно компании: без неё режим
    // заблокирован, поэтому сохранённый выбор восстанавливаем условно.
    setView(storedCompany && readStored(VIEW_KEY) === "companies" ? "companies" : "tree");
    let restored = new Set<string>();
    try {
      const raw = readStored(EXPANDED_KEY);
      if (raw) restored = new Set(JSON.parse(raw) as string[]);
    } catch {
      /* повреждённое состояние — начинаем со свёрнутого дерева */
    }
    // Редирект со снятой family-страницы (#166) просит раскрыть конкретную
    // группу — /patterns?family={code}.
    const targetFamily = new URLSearchParams(window.location.search).get("family");
    if (targetFamily) restored.add(targetFamily);
    if (restored.size > 0) setExpanded(restored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getAtlasCompanies(controller.signal)
      .then((data) => setCompanies(data.companies))
      .catch(() => {
        /* селектор просто останется пустым — атлас работает и без него */
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    setLoadState("loading");
    setError("");

    getAtlas(company || undefined, controller.signal)
      .then((data) => {
        setAtlas(data);
        setLoadState("loaded");
        const targetFamily = new URLSearchParams(window.location.search).get("family");
        if (targetFamily) {
          // Строка рендерится в этом же тике — ждём кадр перед скроллом.
          requestAnimationFrame(() => {
            document
              .getElementById(`atlas-family-row-${targetFamily}`)
              ?.scrollIntoView({ block: "center", behavior: "smooth" });
          });
        }
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 404 && company) {
          // Компания пропала из данных — сбрасываем выбор, не пугаем ошибкой.
          setCompany("");
          writeStored(COMPANY_KEY, null);
          setView("tree");
          writeStored(VIEW_KEY, "tree");
          return;
        }
        setError(e instanceof ApiError ? e.message : copy.errorTitle);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [company, hydrated, reloadVersion, copy.errorTitle]);

  useEffect(() => {
    if (!companyPickerOpen) return;
    companyDialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setCompanyPickerOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [companyPickerOpen]);

  const selectCompany = useCallback((code: string) => {
    setCompany(code);
    writeStored(COMPANY_KEY, code || null);
    if (code) {
      // Выбор компании сразу переключает на режим готовности по ней —
      // иначе выбор выглядит так, будто ничего не произошло.
      setView("companies");
      writeStored(VIEW_KEY, "companies");
    } else {
      setView("tree");
      writeStored(VIEW_KEY, "tree");
    }
  }, []);

  const selectPlatform = useCallback((next: PlatformId | "") => {
    setPlatform(next);
    writeStored(PLATFORM_KEY, next || null);
  }, []);

  const openCompanyPicker = useCallback(() => {
    setCompanyQuery("");
    setCompanyPickerOpen(true);
  }, []);

  const pickCompany = useCallback(
    (code: string) => {
      selectCompany(code);
      setCompanyPickerOpen(false);
    },
    [selectCompany],
  );

  const selectView = useCallback((next: AtlasView) => {
    setView(next);
    writeStored(VIEW_KEY, next);
  }, []);

  const toggleFamily = useCallback((code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      writeStored(EXPANDED_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const subpatternsByCode = useMemo(() => {
    const map = new Map<string, AtlasSubpattern>();
    for (const sub of atlas?.subpatterns ?? []) map.set(sub.code, sub);
    return map;
  }, [atlas]);

  const query = search.trim().toLowerCase();
  const matchesQuery = useCallback(
    (sub: AtlasSubpattern | undefined) =>
      !query || (sub ? sub.name.toLowerCase().includes(query) || sub.code.includes(query) : false),
    [query],
  );

  const visibleFamilies = useMemo(() => {
    if (!atlas) return [];
    return atlas.families
      .map((family) => {
        const allSubs = family.subpattern_codes
          .map((code) => subpatternsByCode.get(code))
          .filter((sub): sub is AtlasSubpattern => sub !== undefined);
        const familyMatches = !query || family.name.toLowerCase().includes(query);
        const subs = query && familyMatches ? allSubs : allSubs.filter(matchesQuery);
        return { family, subs, allSubs, show: subs.length > 0 || familyMatches };
      })
      .filter((entry) => entry.show);
  }, [atlas, subpatternsByCode, matchesQuery, query]);

  const overlay = atlas?.company ?? null;

  const selectedCompanyName = company
    ? companies.find((item) => item.code === company)?.name ?? company
    : copy.companyNone;

  const companyQueryNormalized = companyQuery.trim().toLowerCase();
  const filteredCompanies = useMemo(() => {
    if (!companyQueryNormalized) return companies;
    return companies.filter((item) => item.name.toLowerCase().includes(companyQueryNormalized));
  }, [companies, companyQueryNormalized]);

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="cabinet-page-head__actions">
          <span className="cabinet-next-hint">
            {copy.taxonomyLabel}: <em>{atlas?.taxonomy_version ?? "…"}</em>
          </span>
        </div>
      </section>

      <div className="atlas-toolbar">
        <div className="atlas-company">
          <span>{copy.companyLabel}</span>
          <button
            type="button"
            className="atlas-company__trigger"
            aria-haspopup="dialog"
            aria-expanded={companyPickerOpen}
            aria-label={copy.companyAria}
            onClick={openCompanyPicker}
          >
            {selectedCompanyName}
          </button>
        </div>

        <label className="atlas-company">
          <span>{copy.platformLabel}</span>
          <select
            aria-label={copy.platformAria}
            value={platform}
            onChange={(e) => selectPlatform(e.target.value as PlatformId | "")}
          >
            <option value="">{copy.platformNone}</option>
            {platformOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="atlas-view-toggle" role="tablist" aria-label={copy.viewAria}>
          {(["tree", "companies"] as const).map((item) => {
            const locked = item === "companies" && !company;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={view === item}
                className={view === item ? "is-active" : undefined}
                disabled={locked}
                title={locked ? copy.companyHint : undefined}
                onClick={() => selectView(item)}
              >
                {copy.views[item]}
              </button>
            );
          })}
        </div>

        <input
          className="atlas-search"
          type="search"
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchAria}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {companyPickerOpen ? (
        <div
          className="shell-overlay"
          data-shell-overlay
          role="presentation"
          onClick={() => setCompanyPickerOpen(false)}
        >
          <div
            className="shell-dialog shell-dialog--company"
            role="dialog"
            aria-modal="true"
            aria-label={copy.companyAria}
            ref={companyDialogRef}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="shell-dialog__head">
              <strong>{copy.companyLabel}</strong>
              <button
                className="shell-dialog__close"
                type="button"
                aria-label={copy.close}
                onClick={() => setCompanyPickerOpen(false)}
              >
                ×
              </button>
            </header>
            <input
              className="atlas-company__search"
              type="search"
              autoFocus
              placeholder={copy.companySearchPlaceholder}
              aria-label={copy.companySearchAria}
              value={companyQuery}
              onChange={(e) => setCompanyQuery(e.target.value)}
            />
            <ul className="atlas-company__list" role="listbox" aria-label={copy.companyLabel}>
              <li>
                <button
                  type="button"
                  className={!company ? "atlas-company__option is-active" : "atlas-company__option"}
                  role="option"
                  aria-selected={!company}
                  onClick={() => pickCompany("")}
                >
                  {copy.companyNone}
                </button>
              </li>
              {filteredCompanies.map((item) => (
                <li key={item.code}>
                  <button
                    type="button"
                    className={
                      company === item.code ? "atlas-company__option is-active" : "atlas-company__option"
                    }
                    role="option"
                    aria-selected={company === item.code}
                    onClick={() => pickCompany(item.code)}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
              {filteredCompanies.length === 0 ? (
                <li className="atlas-company__empty">{copy.companyPickerEmpty}</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      {overlay?.demo_only ? (
        <p className="atlas-demo-note">
          <span className="meta-chip meta-chip--muted">{copy.demoBadge}</span> {copy.demoNote}
        </p>
      ) : null}

      {loadState === "loading" ? (
        <CabinetPanel title={copy.loading} padded>
          <p>{copy.loading}</p>
        </CabinetPanel>
      ) : null}

      {loadState === "error" ? (
        <CabinetPanel title={copy.errorTitle} padded>
          <p>{error || copy.errorTitle}</p>
          <button className="btn-ghost" type="button" onClick={() => setReloadVersion((v) => v + 1)}>
            {copy.retry}
          </button>
        </CabinetPanel>
      ) : null}

      {loadState === "loaded" && atlas ? (
        view === "companies" ? (
          <CompaniesView atlas={atlas} copy={copy} />
        ) : (
          <TreeView
            copy={copy}
            visibleFamilies={visibleFamilies}
            expanded={expanded}
            searchActive={query.length > 0}
            onToggle={toggleFamily}
          />
        )
      ) : null}
    </main>
  );
}

function TreeView({
  copy,
  visibleFamilies,
  expanded,
  searchActive,
  onToggle,
}: Readonly<{
  copy: AtlasCopy;
  visibleFamilies: readonly {
    family: AtlasResponse["families"][number];
    subs: readonly AtlasSubpattern[];
    allSubs: readonly AtlasSubpattern[];
  }[];
  expanded: ReadonlySet<string>;
  searchActive: boolean;
  onToggle: (code: string) => void;
}>) {
  return (
    <>
      <CabinetPanel eyebrow="taxonomy" title={copy.familiesTitle} padded>
        {visibleFamilies.length === 0 ? (
          <p>{copy.searchEmpty}</p>
        ) : (
          <div className="atlas-tree" role="table" aria-label={copy.familiesTitle}>
            <div className="atlas-table__head" role="row">
              <span role="columnheader">{copy.familyColumns.pattern}</span>
              <span role="columnheader">{copy.familyColumns.difficulty}</span>
              <span role="columnheader">{copy.familyColumns.tasks}</span>
              <span role="columnheader">{copy.familyColumns.subpatterns}</span>
            </div>
            {visibleFamilies.map(({ family, subs, allSubs }) => {
              const isOpen = searchActive || expanded.has(family.code);
              const stats = familyStats(allSubs);
              const difficulty = familyDifficulty(allSubs, copy);
              const subpatternsId = `atlas-subpatterns-${family.code}`;
              return (
                <div className="atlas-family-group" role="rowgroup" key={family.code}>
                  <div className="atlas-family" role="row" id={`atlas-family-row-${family.code}`}>
                    <span className="atlas-table__cell atlas-table__cell--name" role="cell">
                      <button
                        type="button"
                        className="atlas-family__toggle"
                        aria-expanded={isOpen}
                        aria-controls={subpatternsId}
                        aria-label={`${isOpen ? copy.collapseAria : copy.expandAria}: ${family.name}`}
                        onClick={() => onToggle(family.code)}
                      >
                        <i className={isOpen ? "atlas-caret is-open" : "atlas-caret"} aria-hidden="true" />
                        <span className="atlas-family__name">{family.name}</span>
                      </button>
                    </span>
                    <span className="atlas-table__cell atlas-family__difficulty" role="cell" title={difficulty.title}>
                      {difficulty.known ? (
                        <DifficultyBadges levels={difficulty.levels} />
                      ) : (
                        <>
                          <strong className="is-muted">{difficulty.label}</strong>
                          {difficulty.detail ? <em>{difficulty.detail}</em> : null}
                        </>
                      )}
                    </span>
                    <span className="atlas-table__cell atlas-family__tasks" role="cell">
                      <strong>{stats.problemCount}</strong>
                      <span>{pluralRu(stats.problemCount, copy.taskUnit)}</span>
                    </span>
                    <span className="atlas-table__cell atlas-family__meta" role="cell">
                      <strong>{allSubs.length}</strong>
                      <span>{pluralRu(allSubs.length, copy.subpatternUnit)}</span>
                      {stats.dueCount > 0 ? <em className="atlas-due">{stats.dueCount} {copy.dueLabel}</em> : null}
                    </span>
                  </div>
                  <div
                    className={isOpen ? "atlas-subs-shell is-open" : "atlas-subs-shell"}
                    id={subpatternsId}
                    aria-hidden={!isOpen}
                  >
                    <div className="atlas-subs-shell__inner">
                      <ul className="atlas-subs">
                        {subs.map((sub) => (
                          <SubpatternRow key={sub.code} sub={sub} copy={copy} />
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CabinetPanel>
    </>
  );
}

function SubpatternRow({ sub, copy }: Readonly<{ sub: AtlasSubpattern; copy: AtlasCopy }>) {
  const { mastery, stats } = sub;
  const started = mastery.status !== "not_started";
  const difficulty = difficultyBreakdown(stats.difficulty_counts);
  return (
    <li className="atlas-sub">
      {/* .atlas-sub__link is a fixed 6-column grid — every column below is a
          direct child that always renders (empty when there's nothing to
          show), so the same field lines up in the same column on every row
          instead of shifting left when an earlier field is skipped. */}
      <Link href={`/patterns/${sub.code}`} className="atlas-sub__link">
        <span className="atlas-sub__label">
          <i className={`atlas-dot atlas-dot--${mastery.status}`} aria-hidden="true" />
          <span className="atlas-sub__name">{sub.name}</span>
        </span>
        <span className="atlas-sub__mastery">
          <span className={`atlas-status atlas-status--${mastery.status}`}>
            {copy.masteryStatuses[mastery.status]}
          </span>
          {started ? <span className="atlas-percent">{mastery.percent}%</span> : null}
        </span>
        <span className="atlas-sub__difficulty">
          {difficulty.length > 0 ? <DifficultyBadges levels={difficulty} /> : null}
        </span>
        <span className="atlas-solved">
          {stats.problem_count > 0 ? `${stats.solved_count}/${stats.problem_count}` : ""}
        </span>
        <em className="atlas-due">
          {stats.due_count > 0 ? `${stats.due_count} ${copy.dueLabel}` : ""}
        </em>
        <span className="atlas-sub__relevance-slot">
          {sub.relevance ? <RelevanceBadge level={sub.relevance.relevance} copy={copy} /> : null}
        </span>
      </Link>
    </li>
  );
}

function RelevanceBadge({
  level,
  copy,
}: Readonly<{ level: RelevanceLevel; copy: AtlasCopy }>) {
  return (
    <span className={`atlas-relevance atlas-relevance--${level}`}>
      {copy.relevanceLabels[level]}
    </span>
  );
}

function CompaniesView({ atlas, copy }: Readonly<{ atlas: AtlasResponse; copy: AtlasCopy }>) {
  const overlay = atlas.company;
  if (!overlay) {
    return (
      <CabinetPanel eyebrow="companies" title={copy.coverage.title} padded>
        <p>{copy.coverage.noCompany}</p>
        <p className="atlas-tools-hint">{copy.companyHint}</p>
      </CabinetPanel>
    );
  }

  const coverage = overlay.coverage;
  const problems = overlay.relevant_problems ?? [];
  const problemGroups: {
    code: string;
    name: string;
    problems: AtlasRelevantProblem[];
  }[] = [];
  for (const problem of problems) {
    const last = problemGroups[problemGroups.length - 1];
    if (last && last.code === problem.subpattern_code) {
      last.problems.push(problem);
    } else {
      problemGroups.push({
        code: problem.subpattern_code,
        name: problem.subpattern_name,
        problems: [problem],
      });
    }
  }

  const studied = coverage.strong + coverage.unstable + coverage.weak;

  return (
    <div className="cabinet-grid">
      <CabinetPanel
        eyebrow={overlay.code}
        title={`${overlay.name} ${copy.coverage.title}`}
        padded
        meta={
          overlay.demo_only ? (
            <span className="meta-chip meta-chip--muted">{copy.demoBadge}</span>
          ) : undefined
        }
      >
        <dl className="atlas-coverage">
          <div>
            <dt>{copy.coverage.studied}</dt>
            <dd>
              {studied}/{coverage.relevant_subpatterns}
            </dd>
          </div>
          <div>
            <dt>{copy.coverage.strong}</dt>
            <dd className="confidence--accent">{coverage.strong}</dd>
          </div>
          <div>
            <dt>{copy.coverage.unstable}</dt>
            <dd className="confidence--warning">{coverage.unstable}</dd>
          </div>
          <div>
            <dt>{copy.coverage.weak}</dt>
            <dd className="confidence--danger">{coverage.weak}</dd>
          </div>
        </dl>

        <h3 className="atlas-gaps-title">{copy.coverage.gapsTitle}</h3>
        {coverage.top_gaps.length === 0 ? (
          <p>{copy.coverage.gapsEmpty}</p>
        ) : (
          <ol className="atlas-gaps">
            {coverage.top_gaps.map((gap) => (
              <li key={gap.code}>
                <Link href={`/patterns/${gap.code}`}>{gap.name}</Link>
                <span>
                  <RelevanceBadge level={gap.relevance} copy={copy} />
                  <span className="atlas-percent">{gap.mastery_percent}%</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CabinetPanel>

      <CabinetPanel
        eyebrow="tasks"
        title={copy.coverage.problemsTitle}
        padded
        meta={<span className="cabinet-panel__meta">{problems.length}</span>}
      >
        {problems.length === 0 ? (
          <p>{copy.coverage.problemsEmpty}</p>
        ) : (
          <>
            <p className="atlas-tools-hint">{copy.coverage.problemsHint}</p>
            <ul className="atlas-problems">
              {problemGroups.map((group) => (
                <li key={group.code}>
                  <Link href={`/patterns/${group.code}`} className="atlas-problems__group">
                    {group.name}
                  </Link>
                  <ul>
                    {group.problems.map((problem) => (
                      <li key={`${group.code}-${problem.id}`}>
                        <a href={problem.url} target="_blank" rel="noreferrer">
                          {problem.title}
                        </a>
                        <span className="atlas-problem__meta">
                          {problem.difficulty ? (
                            <span className="meta-chip">{problem.difficulty}</span>
                          ) : null}
                          {problem.tier ? (
                            <span className="meta-chip meta-chip--muted">{problem.tier}</span>
                          ) : null}
                          <span className={`atlas-status atlas-status--${problem.status}`}>
                            {(copy.coverage.problemStatuses as Record<string, string>)[problem.status] ??
                              problem.status}
                          </span>
                          {problem.evidence_count > 0 ? (
                            <span className="atlas-solved">×{problem.evidence_count}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </CabinetPanel>
    </div>
  );
}
