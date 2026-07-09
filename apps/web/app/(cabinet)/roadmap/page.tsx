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

  const stateOf = (status: keyof typeof statuses) => {
    return { name: status, label: statuses[status] };
  };

  const isDoneStatus = (status: string) => status === "done";
  const isWeekLocked = (index: number) =>
    roadmapWeeks.slice(0, index).some((previousWeek) => !isDoneStatus(previousWeek.status));
  const progressOf = (week: (typeof roadmapWeeks)[number], index: number) =>
    isWeekLocked(index) ? 0 : week.progress;

  const overall = Math.round(
    roadmapWeeks.reduce((sum, week, index) => sum + progressOf(week, index), 0) / roadmapWeeks.length,
  );

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
            const isLocked = isWeekLocked(index);
            const visibleProgress = progressOf(week, index);
            return (
              <li className={`roadmap-step roadmap-step--${state.name}`} key={week.id}>
                <div className="roadmap-step__rail">
                  <span className="roadmap-step__node">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="roadmap-step__body">
                  <div className="roadmap-step__main">
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
                      <ProgressBar value={visibleProgress} label={`${week.title} progress`} />
                      <strong>{visibleProgress}%</strong>
                    </div>
                  </div>
                  {isLocked ? (
                    <div className="roadmap-step__practice-card roadmap-step__practice-card--locked">
                      <span className="roadmap-step__practice-eyebrow">{page.lockedEyebrow}</span>
                      <strong>{page.lockedTitle}</strong>
                    </div>
                  ) : (
                    <Link className="roadmap-step__practice-card" href={week.practiceHref}>
                      <span className="roadmap-step__practice-eyebrow">{page.practiceEyebrow}</span>
                      <strong>{page.practiceCta}</strong>
                      <em>
                        {page.practiceAction}
                        <CabinetIcon name="arrow" />
                      </em>
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CabinetPanel>
    </main>
  );
}
