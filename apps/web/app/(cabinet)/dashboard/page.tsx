import Link from "next/link";

import { ActivityHeatmap, CabinetPanel, MetricCard, ProgressBar } from "../_components";
import { CabinetIcon } from "../_icons";
import { getDictionary } from "../../_content/i18n";
import {
  activityActiveDays,
  activityTotalReviews,
  activityCounts,
  activityWeeks,
  overviewStats,
  reviewQueue,
  weakPatterns,
} from "../_mock";

function confidenceTone(value: number) {
  if (value < 45) return "danger";
  if (value < 60) return "warning";
  return "accent";
}

export default function DashboardPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.dashboard;
  const typeTones = new Map(copy.pages.reviews.types.map(([key, , tone]) => [key, tone]));

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
      </section>

      <CabinetPanel title={page.heatmap.title}>
        <div className="heatmap-layout">
          <div>
            <ActivityHeatmap
              weeks={activityWeeks}
              counts={activityCounts}
              tooltip={page.heatmap.tooltip}
              ariaLabel={page.heatmap.aria}
              footLeft={page.heatmap.foot}
              scaleLess={page.heatmap.scaleLess}
              scaleMore={page.heatmap.scaleMore}
            />
          </div>
          <div className="heatmap-stats">
            <div>
              <strong>{activityActiveDays}</strong>
              <span>{page.heatmap.statDays}</span>
            </div>
            <div>
              <strong>{activityTotalReviews}</strong>
              <span>{page.heatmap.statReviews}</span>
            </div>
            <div>
              <strong>{overviewStats[3].value}</strong>
              <span>{page.heatmap.statStreak}</span>
            </div>
          </div>
          <aside className="next-up">
            <div className="next-up__body">
              <span className="next-up__eyebrow">{page.nextLabel}</span>
              <strong className="next-up__title">{page.nextTitle}</strong>
              <span className="next-up__meta">{page.nextMeta}</span>
            </div>
            <div className="next-up__actions">
              <Link className="cabinet-cta" href="/cards/session">
                {copy.common.startReview}
                <CabinetIcon name="arrow" />
              </Link>
              <Link className="cabinet-ghost-link" href="/reviews">
                {page.openQueue}
              </Link>
            </div>
          </aside>
        </div>
      </CabinetPanel>

      <section className="metric-grid">
        {overviewStats.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </section>

      <div className="cabinet-grid">
        <CabinetPanel
          title={page.queueTitle}
          meta={
            <Link className="cabinet-panel__meta" href="/reviews">
              {copy.common.viewAll}
            </Link>
          }
        >
          <div className="review-list">
            {reviewQueue.slice(0, 5).map((item) => {
              const [day, time] = item.next.split(" · ");
              const tone = typeTones.get(item.type) ?? "accent";
              return (
                <article className="review-list__item" key={item.id}>
                  <div className="review-list__main">
                    <div className="review-list__title-row">
                      <span className={`review-type review-type--${tone}`} aria-hidden="true" />
                      <strong>{item.title}</strong>
                    </div>
                    <p>{item.meta}</p>
                  </div>
                  <div className="review-list__side">
                    <span className="review-when">
                      <em>{day} · </em>
                      {time}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </CabinetPanel>

        <CabinetPanel
          title={page.patternsTitle}
          meta={
            <Link className="cabinet-panel__meta" href="/patterns">
              {copy.common.viewAll}
            </Link>
          }
        >
          <div className="pattern-stack">
            {weakPatterns.map((pattern) => (
              <article key={pattern.name}>
                <div>
                  <strong>{pattern.name}</strong>
                  <span className={`confidence--${confidenceTone(pattern.confidence)}`}>
                    {pattern.confidence}%
                  </span>
                </div>
                <ProgressBar
                  value={pattern.confidence}
                  tone={
                    pattern.confidence < 45
                      ? "danger"
                      : pattern.confidence < 60
                        ? "warning"
                        : "default"
                  }
                  label={`${pattern.name} confidence`}
                />
                <p>{pattern.signal}</p>
              </article>
            ))}
          </div>
        </CabinetPanel>
      </div>
    </main>
  );
}
