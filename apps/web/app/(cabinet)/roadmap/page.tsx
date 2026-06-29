import { CabinetPanel, ProgressBar, StatusPill } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { roadmapWeeks } from "../_mock";

export default function RoadmapPage() {
  const page = getDictionary().cabinet.pages.roadmap;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <div className="roadmap-stack">
          {roadmapWeeks.map((week) => (
            <article className="cabinet-roadmap-row" key={week.week}>
              <span>{week.week}</span>
              <div>
                <strong>{week.title}</strong>
                <p>{week.focus}</p>
                <ProgressBar value={week.progress} label={`${week.title} progress`} />
              </div>
              <StatusPill tone="success">{week.progress}%</StatusPill>
            </article>
          ))}
        </div>
      </CabinetPanel>
    </main>
  );
}
