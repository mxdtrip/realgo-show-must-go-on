import { CabinetPanel, ProgressBar } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { roadmapWeeks } from "../_mock";

export default function RoadmapPage() {
  const page = getDictionary().cabinet.pages.roadmap;

  const overall = Math.round(
    roadmapWeeks.reduce((sum, week) => sum + week.progress, 0) / roadmapWeeks.length,
  );

  const stateOf = (progress: number) => {
    if (progress >= 70) return { name: "done", label: page.statusDone };
    if (progress >= 30) return { name: "active", label: page.statusActive };
    return { name: "todo", label: page.statusTodo };
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
            const state = stateOf(week.progress);
            return (
              <li className={`roadmap-step roadmap-step--${state.name}`} key={week.week}>
                <div className="roadmap-step__rail">
                  <span className="roadmap-step__node">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="roadmap-step__body">
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
                </div>
              </li>
            );
          })}
        </ol>
      </CabinetPanel>
    </main>
  );
}
