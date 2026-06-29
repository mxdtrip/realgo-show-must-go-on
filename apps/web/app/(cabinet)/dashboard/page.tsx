import { CabinetPanel, MetricCard, ProgressBar, StatusPill } from "../_components";
import { overviewStats, reviewQueue, roadmapWeeks, weakPatterns } from "../_mock";

export default function DashboardPage() {
  return (
    <main className="cabinet-page">
      <section className="cabinet-hero">
        <div>
          <span className="cabinet-eyebrow">/dashboard</span>
          <h1>Сегодня повторяем то, что реально может забыться.</h1>
          <p>
            Стартовый моковый кабинет показывает главный рабочий контур Engram: очередь повторений,
            слабые паттерны, прогресс roadmap и состояние подготовки.
          </p>
        </div>
        <div className="cabinet-hero__card">
          <span>next action</span>
          <strong>Longest Substring</strong>
          <p>Sliding Window · hard · сегодня</p>
          <button>Start review</button>
        </div>
      </section>

      <section className="metric-grid">
        {overviewStats.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </section>

      <div className="cabinet-grid">
        <CabinetPanel eyebrow="queue" title="Ближайшие повторения">
          <div className="review-list">
            {reviewQueue.slice(0, 3).map((item) => (
              <article className="review-list__item" key={item.id}>
                <div>
                  <span>{item.type}</span>
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                </div>
                <StatusPill tone={item.rating === "hard" ? "warning" : "accent"}>{item.next}</StatusPill>
              </article>
            ))}
          </div>
        </CabinetPanel>

        <CabinetPanel eyebrow="patterns" title="Слабые зоны">
          <div className="pattern-stack">
            {weakPatterns.map((pattern) => (
              <article key={pattern.name}>
                <div>
                  <strong>{pattern.name}</strong>
                  <span>{pattern.confidence}%</span>
                </div>
                <ProgressBar value={pattern.confidence} label={`${pattern.name} confidence`} />
                <p>{pattern.signal}</p>
              </article>
            ))}
          </div>
        </CabinetPanel>
      </div>

      <CabinetPanel eyebrow="roadmap" title="Engram Core Roadmap">
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
