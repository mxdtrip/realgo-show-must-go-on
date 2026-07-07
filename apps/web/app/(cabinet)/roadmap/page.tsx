import Link from "next/link";

import { CabinetPanel, ProgressBar } from "../_components";
import { CabinetIcon } from "../_icons";
import { getDictionary } from "../../_content/i18n";
import { roadmapWeeks } from "../_mock";

export default function RoadmapPage() {
  const page = getDictionary().cabinet.pages.roadmap;
  const statuses = {
    done: page.statusDone,
    active: page.statusActive,
    todo: page.statusTodo,
  } as const;

  const overall = Math.round(
    roadmapWeeks.reduce((sum, week) => sum + week.progress, 0) / roadmapWeeks.length,
  );

  const stateOf = (status: keyof typeof statuses) => {
    return { name: status, label: statuses[status] };
  };

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <div className="cabinet-page-head__actions">
          <span className="cabinet-next-hint">
            {page.interviewHint} · <em>{page.dayHint}</em>
          </span>
          <span className="cabinet-next-hint">
            <em>{overall}%</em> {page.overallLabel}
          </span>
        </div>
      </section>

      <CabinetPanel
        eyebrow={page.panelEyebrow}
        title={page.panelTitle}
        meta={
          <span className="cabinet-panel__meta">
            {overall}% {page.overallLabel}
          </span>
        }
      >
        <ol className="roadmap-track">
          {roadmapWeeks.map((week, index) => {
            const state = stateOf(week.status);
            return (
              <li className={`roadmap-step roadmap-step--${state.name}`} key={week.id}>
                <div className="roadmap-step__rail">
                  <span className="roadmap-step__node">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <details className="roadmap-step__body" open={state.name === "active"}>
                  <summary className="roadmap-step__summary">
                    <div className="roadmap-step__head">
                      <span className="roadmap-step__week">{week.week}</span>
                      <span className="roadmap-step__state">{state.label}</span>
                      {state.name === "active" ? (
                        <span className="roadmap-step__now">{page.nowLabel}</span>
                      ) : null}
                    </div>
                    <h2>{week.title}</h2>
                    <p>{week.focus}</p>
                    <div className="roadmap-step__progress">
                      <ProgressBar value={week.progress} label={`${week.title} progress`} />
                      <strong>{week.progress}%</strong>
                    </div>
                  </summary>

                  <div className="roadmap-step__details">
                    <div className="roadmap-step__details-head">
                      <span>{page.remainingTitle}</span>
                      <span>
                        {week.items.length} {page.subpatternsLabel}
                      </span>
                    </div>
                    <div className="roadmap-subpatterns">
                      {week.items.map((item) => (
                        <article className="roadmap-subpattern" key={item.code}>
                          <div className="roadmap-subpattern__main">
                            <div>
                              <Link href={`/patterns/${item.code}`}>{item.name}</Link>
                              <span>{item.state}</span>
                            </div>
                            <p>{item.remaining}</p>
                          </div>
                          <div className="roadmap-subpattern__actions">
                            <span className="roadmap-subpattern__score">{item.confidence}%</span>
                            <Link className="roadmap-subpattern__practice" href={`/patterns/${item.code}/session`}>
                              {page.practiceCta}
                              <CabinetIcon name="arrow" />
                            </Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </CabinetPanel>
    </main>
  );
}
