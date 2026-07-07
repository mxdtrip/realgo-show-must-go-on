"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getAtlasNode,
  type CardSummary,
  type NodeDetail,
  type PracticeProblem,
} from "../../../../_api/atlas";
import { ApiError } from "../../../../_api/types";
import { CabinetPanel, ProgressBar, StatusPill } from "../../../_components";
import { CabinetIcon } from "../../../_icons";
import { PatternProfile } from "./PatternProfile";
import type { getDictionary } from "../../../../_content/i18n";

type NodeCopy = ReturnType<typeof getDictionary>["cabinet"]["pages"]["atlasNode"];
type AtlasCopy = ReturnType<typeof getDictionary>["cabinet"]["pages"]["atlas"];

type LoadState = "loading" | "loaded" | "not_found" | "error";

function pluralRu(n: number, forms: readonly string[]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

function formatReview(value: string | undefined, copy: NodeCopy): string {
  if (!value) return copy.noReviews;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return copy.noReviews;
  if (date.getTime() <= Date.now()) return copy.dueNow;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
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

  const isFamilyProfile = loadState === "loaded" && detail?.kind === "family";

  return (
    <main className={isFamilyProfile ? "cabinet-page cabinet-page--pattern" : "cabinet-page"}>
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
          <NodeBody detail={detail} copy={copy} atlasCopy={atlasCopy} />
        )
      ) : null}
    </main>
  );
}

function NodeBody({
  detail,
  copy,
  atlasCopy,
}: Readonly<{ detail: NodeDetail; copy: NodeCopy; atlasCopy: AtlasCopy }>) {
  const mastery = detail.mastery;
  const stats = detail.stats;

  return (
    <>
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">
            {copy.eyebrow} · {copy.kindLabels[detail.kind]}
          </span>
          <h1>{detail.name}</h1>
          {detail.description ? <p>{detail.description}</p> : null}
          <p className="atlas-node-refs">
            {detail.families && detail.families.length > 0 ? (
              <span>
                {copy.familiesLabel}:{" "}
                {detail.families.map((family, index) => (
                  <span key={family.code}>
                    {index > 0 ? ", " : null}
                    {family.name}
                  </span>
                ))}
              </span>
            ) : null}
            {detail.tools && detail.tools.length > 0 ? (
              <span className="atlas-node-tools">
                {copy.toolsLabel}:{" "}
                {detail.tools.map((tool) => (
                  <span className="meta-chip" key={tool.code}>
                    {tool.name}
                  </span>
                ))}
              </span>
            ) : null}
          </p>
        </div>
        {mastery && stats ? (
          <div className="cabinet-page-head__actions">
            <div className="atlas-node-mastery">
              <span className="cabinet-next-hint">
                {copy.masteryLabel}:{" "}
                <em>
                  {atlasCopy.masteryStatuses[mastery.status]}
                  {mastery.status !== "not_started" ? ` · ${mastery.percent}%` : ""}
                </em>
              </span>
              {mastery.status !== "not_started" ? (
                <ProgressBar
                  value={mastery.percent}
                  label={`${detail.name} mastery`}
                  tone={mastery.percent < 40 ? "danger" : mastery.percent < 70 ? "warning" : "default"}
                />
              ) : null}
              <span className="atlas-node-substats">
                {stats.problem_count > 0 ? (
                  <span>
                    {copy.solvedLabel}: {stats.solved_count}/{stats.problem_count}
                  </span>
                ) : null}
                <span>
                  {copy.nextReviewLabel}: {formatReview(stats.next_review_at, copy)}
                </span>
              </span>
            </div>
          </div>
        ) : null}
      </section>

      <nav className="atlas-node-actions" aria-label={copy.actions.session}>
        <Link className="cabinet-cta" href={`/patterns/${detail.code}/session`}>
          {copy.actions.session}
          <CabinetIcon name="arrow" />
        </Link>
      </nav>

      <div className="cabinet-grid">
        <LearnPanel detail={detail} copy={copy} />
        <CardsPanel cards={detail.cards} copy={copy} />
        <PracticePanel practice={detail.practice} copy={copy} />
        <CompanyPanel detail={detail} copy={copy} atlasCopy={atlasCopy} />
      </div>
    </>
  );
}

function LearnPanel({ detail, copy }: Readonly<{ detail: NodeDetail; copy: NodeCopy }>) {
  const material = detail.material;
  return (
    <CabinetPanel eyebrow="learn" title={copy.learn.title} padded>
      {!material ? (
        <p>{copy.learn.preparing}</p>
      ) : (
        <div className="atlas-learn">
          <h3>{copy.learn.whatItIs}</h3>
          <p>{material.what_it_is}</p>

          {material.recognition_cues.length > 0 ? (
            <>
              <h3>{copy.learn.recognitionCues}</h3>
              <ul className="pattern-detail-list">
                {material.recognition_cues.map((cue) => (
                  <li key={cue}>{cue}</li>
                ))}
              </ul>
            </>
          ) : null}

          {material.mental_model ? (
            <>
              <h3>{copy.learn.mentalModel}</h3>
              <p>{material.mental_model}</p>
            </>
          ) : null}

          {material.anti_cues.length > 0 ? (
            <>
              <h3>{copy.learn.antiCues}</h3>
              <ul className="pattern-detail-list atlas-anti-cues">
                {material.anti_cues.map((cue) => (
                  <li key={cue}>{cue}</li>
                ))}
              </ul>
            </>
          ) : null}

          {material.core_invariant ? (
            <>
              <h3>{copy.learn.coreInvariant}</h3>
              <p>{material.core_invariant}</p>
            </>
          ) : null}

          {material.canonical_skeleton ? (
            <>
              <h3>{copy.learn.skeleton}</h3>
              <pre className="atlas-skeleton">
                <code>{material.canonical_skeleton}</code>
              </pre>
            </>
          ) : null}

          {material.mini_example ? (
            <>
              <h3>{copy.learn.miniExample}</h3>
              <p>{material.mini_example}</p>
            </>
          ) : null}

          {material.common_mistakes.length > 0 ? (
            <>
              <h3>{copy.learn.commonMistakes}</h3>
              <ul className="pattern-detail-list">
                {material.common_mistakes.map((mistake) => (
                  <li key={mistake}>{mistake}</li>
                ))}
              </ul>
            </>
          ) : null}

          {material.dont_confuse_with.length > 0 ? (
            <>
              <h3>{copy.learn.dontConfuse}</h3>
              <dl className="atlas-contrast">
                {material.dont_confuse_with.map((pair) => (
                  <div key={pair.title}>
                    <dt>{pair.title}</dt>
                    <dd>{pair.note}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
        </div>
      )}
    </CabinetPanel>
  );
}

function CardsPanel({ cards, copy }: Readonly<{ cards: CardSummary[]; copy: NodeCopy }>) {
  const typeLabel = (type: string) =>
    (copy.cards.types as Record<string, string>)[type] ?? type;
  return (
    <CabinetPanel
      eyebrow="cards"
      title={copy.cards.title}
      padded
      meta={<span className="cabinet-panel__meta">{cards.length}</span>}
    >
      {cards.length === 0 ? (
        <p>{copy.cards.empty}</p>
      ) : (
        <ul className="atlas-cards">
          {cards.map((card) => (
            <li key={card.id}>
              <StatusPill tone="default">{typeLabel(card.type)}</StatusPill>
              <span>{card.question}</span>
            </li>
          ))}
        </ul>
      )}
    </CabinetPanel>
  );
}

function ProblemRow({
  problem,
  copy,
}: Readonly<{ problem: PracticeProblem; copy: NodeCopy }>) {
  const statusLabel =
    (copy.practice.statuses as Record<string, string>)[problem.status] ?? problem.status;
  const solved = problem.status === "solved" || problem.status === "reviewing";
  return (
    <li className="atlas-problem">
      <a href={problem.url} target="_blank" rel="noreferrer">
        {problem.title}
      </a>
      <span className="atlas-problem__meta">
        {problem.tier ? (
          <span className="meta-chip meta-chip--muted">
            {(copy.practice.tiers as Record<string, string>)[problem.tier] ?? problem.tier}
          </span>
        ) : null}
        {problem.difficulty ? <span className="atlas-difficulty">{problem.difficulty}</span> : null}
        <StatusPill tone={solved ? "success" : problem.status === "in_progress" ? "accent" : "default"}>
          {statusLabel}
        </StatusPill>
      </span>
    </li>
  );
}

function PracticePanel({
  practice,
  copy,
}: Readonly<{ practice: PracticeProblem[]; copy: NodeCopy }>) {
  return (
    <CabinetPanel
      eyebrow="practice"
      title={copy.practice.title}
      padded
      meta={<span className="cabinet-panel__meta">{practice.length}</span>}
    >
      {practice.length === 0 ? (
        <p>{copy.practice.empty}</p>
      ) : (
        <ul className="atlas-problems">
          {practice.map((problem) => (
            <ProblemRow key={problem.id} problem={problem} copy={copy} />
          ))}
        </ul>
      )}
    </CabinetPanel>
  );
}

function CompanyPanel({
  detail,
  copy,
  atlasCopy,
}: Readonly<{ detail: NodeDetail; copy: NodeCopy; atlasCopy: AtlasCopy }>) {
  return (
    <CabinetPanel eyebrow="company practice" title={copy.companyPractice.title} padded>
      {detail.company_practice.length === 0 ? (
        <p>{copy.companyPractice.empty}</p>
      ) : (
        <div className="atlas-company-groups">
          {detail.company_practice.map((group) => (
            <div key={group.company.code}>
              <h3>{group.company.name}</h3>
              <ul className="atlas-problems">
                {group.problems.map((problem) => (
                  <li className="atlas-problem" key={`${group.company.code}-${problem.id}`}>
                    <a href={problem.url} target="_blank" rel="noreferrer">
                      {problem.title}
                    </a>
                    <span className="atlas-problem__meta">
                      {problem.difficulty ? (
                        <span className="atlas-difficulty">{problem.difficulty}</span>
                      ) : null}
                      <span>
                        {problem.evidence_count}{" "}
                        {pluralRu(problem.evidence_count, copy.companyPractice.evidenceUnit)}
                      </span>
                      {problem.source_type === "demo" ? (
                        <span className="meta-chip meta-chip--muted">{atlasCopy.demoBadge}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </CabinetPanel>
  );
}
