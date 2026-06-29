import Link from "next/link";

import { CabinetPanel, MetricCard, ProgressBar, StatusPill } from "../_components";
import { CabinetIcon } from "../_icons";
import { getDictionary } from "../../_content/i18n";
import { overviewStats, reviewQueue, roadmapWeeks, weakPatterns } from "../_mock";

export default function DashboardPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.dashboard;

  return (
    <main className="cabinet-page">
      <section className="cabinet-hero">
        <div>
          <span className="cabinet-eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <aside className="cabinet-hero__card">
          <StatusPill tone="accent">{page.nextUp}</StatusPill>
          <span className="cabinet-hero__card-kicker">{page.nextAction}</span>
          <strong>{page.nextTitle}</strong>
          <p>{page.nextMeta}</p>
          <div className="cabinet-hero__card-actions">
            <Link className="cabinet-hero__cta" href="/cards/session">
              {copy.common.startReview}
              <CabinetIcon name="arrow" />
            </Link>
            <Link className="cabinet-hero__ghost" href="/reviews">
              {page.openQueue}
            </Link>
          </div>
        </aside>
      </section>

      <section className="metric-grid">
        {overviewStats.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </section>

      <div className="cabinet-grid">
        <CabinetPanel eyebrow={page.queueEyebrow} title={page.queueTitle}>
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

        <CabinetPanel eyebrow={page.patternsEyebrow} title={page.patternsTitle}>
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

      <CabinetPanel eyebrow={page.roadmapEyebrow} title={page.roadmapTitle}>
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
