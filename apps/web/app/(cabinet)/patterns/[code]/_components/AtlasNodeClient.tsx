"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getAtlasNode,
  type NodeDetail,
  type PracticeProblem,
} from "../../../../_api/atlas";
import { ApiError } from "../../../../_api/types";
import { CabinetPanel } from "../../../_components";
import { PatternProfile, ProfileSection } from "./PatternProfile";
import type { getDictionary } from "../../../../_content/i18n";

type NodeCopy = ReturnType<typeof getDictionary>["cabinet"]["pages"]["atlasNode"];
type AtlasCopy = ReturnType<typeof getDictionary>["cabinet"]["pages"]["atlas"];

type LoadState = "loading" | "loaded" | "not_found" | "error";

function formatReview(value: string | undefined, copy: NodeCopy): string {
  if (!value) return copy.noReviews;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return copy.noReviews;
  if (date.getTime() <= Date.now()) return copy.dueNow;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// what_it_is и другие текстовые секции приходят с абзацами через \n\n.
function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function AtlasNodeClient({
  code,
  copy,
  atlasCopy,
}: Readonly<{ code: string; copy: NodeCopy; atlasCopy: AtlasCopy }>) {
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    setError("");

    getAtlasNode(code, controller.signal)
      .then((data) => {
        // Субпаттерн = рабочий узел, семейство = страница паттерна;
        // у tool/pattern своих страниц нет.
        if (data.kind !== "subpattern" && data.kind !== "family") {
          setDetail(null);
          setLoadState("not_found");
          return;
        }
        setDetail(data);
        setLoadState("loaded");
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 404) {
          setLoadState("not_found");
          return;
        }
        setError(e instanceof ApiError ? e.message : copy.errorTitle);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [code, copy.errorTitle, reloadVersion]);

  const isProfile = loadState === "loaded" && detail !== null;

  return (
    <main className={isProfile ? "cabinet-page cabinet-page--pattern" : "cabinet-page"}>
      <Link className="cabinet-ghost-link" href="/patterns">
        {copy.backLink}
      </Link>

      {loadState === "loading" ? (
        <CabinetPanel title={copy.loading} padded>
          <p>{copy.loading}</p>
        </CabinetPanel>
      ) : null}

      {loadState === "not_found" ? (
        <CabinetPanel title={copy.notFoundTitle} padded>
          <p>{copy.notFoundTitle}</p>
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

      {loadState === "loaded" && detail ? (
        detail.kind === "family" ? (
          <PatternProfile detail={detail} copy={copy.profile} />
        ) : (
          <SubpatternProfile detail={detail} copy={copy} atlasCopy={atlasCopy} />
        )
      ) : null}
    </main>
  );
}

function SubpatternProfile({
  detail,
  copy,
  atlasCopy,
}: Readonly<{ detail: NodeDetail; copy: NodeCopy; atlasCopy: AtlasCopy }>) {
  const material = detail.material;
  const mastery = detail.mastery;
  const stats = detail.stats;
  const problems = detail.practice;

  // problem id -> названия компаний, у которых задача встречалась в собесах.
  const companiesByProblem = new Map<number, string[]>();
  for (const group of detail.company_practice) {
    for (const problem of group.problems) {
      const list = companiesByProblem.get(problem.id) ?? [];
      list.push(group.company.name);
      companiesByProblem.set(problem.id, list);
    }
  }

  const tierLabel = (tier: string) =>
    (copy.practice.tiers as Record<string, string>)[tier] ?? tier;

  return (
    <article className="pattern-profile">
      <header className="pattern-profile__hero pattern-profile__hero--split">
        <div className="pattern-profile__hero-main">
          <span className="pattern-profile__code">
            {copy.kindLabels[detail.kind]} // {detail.code}
          </span>
          <h1>{detail.name}</h1>
          {detail.description ? (
            <p className="pattern-profile__lead">{detail.description}</p>
          ) : null}
          {mastery && stats ? (
            <p className="pattern-profile__mastery">
              {copy.masteryLabel}:{" "}
              <em>
                {atlasCopy.masteryStatuses[mastery.status]}
                {mastery.status !== "not_started" ? ` · ${mastery.percent}%` : ""}
              </em>
              {stats.problem_count > 0 ? (
                <>
                  {" · "}
                  {copy.solvedLabel} {stats.solved_count}/{stats.problem_count}
                </>
              ) : null}
              {" · "}
              {copy.nextReviewLabel}: {formatReview(stats.next_review_at, copy)}
            </p>
          ) : null}
        </div>
        <Link className="pattern-profile__cta" href={`/patterns/${detail.code}/session`}>
          <span className="pattern-profile__sub-head">
            <span>{copy.cta.eyebrow}</span>
            <span className="pattern-profile__sub-arrow" aria-hidden="true">
              →
            </span>
          </span>
          <span className="pattern-profile__sub-name">{copy.cta.title}</span>
          <span className="pattern-profile__sub-note">{copy.cta.note}</span>
        </Link>
      </header>

      {material ? (
        <>
          <ProfileSection
            title={copy.learn.whatItIs}
            empty={!material.what_it_is}
            pendingNote={copy.learn.preparing}
            pendingBadge={copy.profile.pendingBadge}
          >
            {paragraphs(material.what_it_is).map((part) => (
              <p key={part}>{part}</p>
            ))}
          </ProfileSection>

          {material.recognition_cues.length > 0 ? (
            <ProfileSection
              title={copy.learn.recognitionCues}
              empty={false}
              pendingNote={copy.learn.preparing}
              pendingBadge={copy.profile.pendingBadge}
            >
              <ul className="pattern-profile__list pattern-profile__list--cues">
                {material.recognition_cues.map((cue) => (
                  <li key={cue}>{cue}</li>
                ))}
              </ul>
            </ProfileSection>
          ) : null}

          {material.mental_model ? (
            <ProfileSection
              title={copy.learn.mentalModel}
              empty={false}
              pendingNote={copy.learn.preparing}
              pendingBadge={copy.profile.pendingBadge}
            >
              {paragraphs(material.mental_model).map((part) => (
                <p key={part}>{part}</p>
              ))}
            </ProfileSection>
          ) : null}

          {material.anti_cues.length > 0 ? (
            <ProfileSection
              title={copy.learn.antiCues}
              empty={false}
              pendingNote={copy.learn.preparing}
              pendingBadge={copy.profile.pendingBadge}
            >
              <ul className="pattern-profile__list pattern-profile__list--misfits">
                {material.anti_cues.map((cue) => (
                  <li key={cue}>{cue}</li>
                ))}
              </ul>
            </ProfileSection>
          ) : null}

          {material.core_invariant ? (
            <ProfileSection
              title={copy.learn.coreInvariant}
              empty={false}
              pendingNote={copy.learn.preparing}
              pendingBadge={copy.profile.pendingBadge}
            >
              {paragraphs(material.core_invariant).map((part) => (
                <p key={part}>{part}</p>
              ))}
            </ProfileSection>
          ) : null}

          {material.canonical_skeleton ? (
            <ProfileSection
              title={copy.learn.skeleton}
              empty={false}
              pendingNote={copy.learn.preparing}
              pendingBadge={copy.profile.pendingBadge}
            >
              <pre className="atlas-skeleton">
                <code>{material.canonical_skeleton}</code>
              </pre>
            </ProfileSection>
          ) : null}

          {material.mini_example ? (
            <ProfileSection
              title={copy.learn.miniExample}
              empty={false}
              pendingNote={copy.learn.preparing}
              pendingBadge={copy.profile.pendingBadge}
            >
              {paragraphs(material.mini_example).map((part) => (
                <p key={part}>{part}</p>
              ))}
            </ProfileSection>
          ) : null}

          {material.common_mistakes.length > 0 ? (
            <ProfileSection
              title={copy.learn.commonMistakes}
              empty={false}
              pendingNote={copy.learn.preparing}
              pendingBadge={copy.profile.pendingBadge}
            >
              <ul className="pattern-profile__list pattern-profile__list--mechanics">
                {material.common_mistakes.map((mistake) => (
                  <li key={mistake}>{mistake}</li>
                ))}
              </ul>
            </ProfileSection>
          ) : null}

          {material.dont_confuse_with.length > 0 ? (
            <ProfileSection
              title={copy.learn.dontConfuse}
              empty={false}
              pendingNote={copy.learn.preparing}
              pendingBadge={copy.profile.pendingBadge}
            >
              <dl className="atlas-contrast">
                {material.dont_confuse_with.map((pair) => (
                  <div key={pair.title}>
                    <dt>{pair.title}</dt>
                    <dd>{pair.note}</dd>
                  </div>
                ))}
              </dl>
            </ProfileSection>
          ) : null}
        </>
      ) : (
        <ProfileSection
          title={copy.learn.title}
          empty
          pendingNote={copy.learn.preparing}
          pendingBadge={copy.profile.pendingBadge}
        >
          {null}
        </ProfileSection>
      )}

      <ProfileSection
        title={copy.problems.title}
        hint={copy.problems.hint}
        empty={problems.length === 0}
        pendingNote={copy.practice.empty}
        pendingBadge={copy.profile.pendingBadge}
      >
        <ul className="pattern-profile__subs">
          {problems.map((problem, index) => (
            <ProblemCard
              key={problem.id}
              problem={problem}
              index={index}
              companies={companiesByProblem.get(problem.id) ?? []}
              copy={copy}
              tierLabel={tierLabel}
            />
          ))}
        </ul>
      </ProfileSection>
    </article>
  );
}

function ProblemCard({
  problem,
  index,
  companies,
  copy,
  tierLabel,
}: Readonly<{
  problem: PracticeProblem;
  index: number;
  companies: string[];
  copy: NodeCopy;
  tierLabel: (tier: string) => string;
}>) {
  const meta = [String(index + 1).padStart(2, "0")];
  if (problem.difficulty) meta.push(problem.difficulty.toLowerCase());
  if (problem.tier) meta.push(tierLabel(problem.tier));
  const statusLabel =
    problem.status !== "not_started"
      ? ((copy.practice.statuses as Record<string, string>)[problem.status] ?? problem.status)
      : "";
  if (statusLabel) meta.push(statusLabel);

  return (
    <li>
      <a href={problem.url} target="_blank" rel="noreferrer">
        <span className="pattern-profile__sub-head">
          <span>{meta.join(" · ")}</span>
          <span className="pattern-profile__sub-arrow" aria-hidden="true">
            ↗
          </span>
        </span>
        <span className="pattern-profile__sub-name">{problem.title}</span>
        <span
          className={
            companies.length > 0
              ? "pattern-profile__sub-note"
              : "pattern-profile__sub-note is-pending"
          }
        >
          {companies.length > 0 ? companies.join(", ") : copy.problems.companiesNone}
        </span>
      </a>
    </li>
  );
}
