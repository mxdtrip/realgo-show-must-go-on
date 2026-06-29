import { CabinetPanel, ProgressBar, StatusPill } from "../_components";
import { roadmapWeeks } from "../_mock";

export default function RoadmapPage() {
  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">/roadmap</span>
        <h1>Engram Core Roadmap</h1>
        <p>Первый кабинет показывает собственный roadmap Engram без копирования чужих курсов и premium-данных.</p>
      </section>

      <CabinetPanel eyebrow="plan" title="21-day preparation track">
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
