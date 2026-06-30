import { CabinetPanel } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { reviewQueue } from "../_mock";

export default function ReviewsPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.reviews;

  const toneByType = new Map(page.types.map(([key, , tone]) => [key, tone]));
  const summary = page.types.map(([key, label, tone]) => ({
    label,
    tone,
    count: reviewQueue.filter((item) => item.type === key).length,
  }));

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      <div className="cabinet-summary">
        <div className="cabinet-summary__total">
          <strong>{reviewQueue.length}</strong>
          <span>{page.summaryUnit}</span>
        </div>
        <div className="cabinet-summary__split">
          {summary.map((item) => (
            <span className={`review-type review-type--${item.tone}`} key={item.label}>
              {item.label}
              <em>{item.count}</em>
            </span>
          ))}
        </div>
      </div>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <div className="review-board">
          {reviewQueue.map((item) => {
            const [day, time] = item.next.split(" · ");
            const tone = toneByType.get(item.type) ?? "accent";
            return (
              <article className="review-board__item" key={item.id}>
                <div className="review-board__main">
                  <span className={`review-type review-type--${tone}`}>{item.type}</span>
                  <h2>{item.title}</h2>
                  <p>{item.meta}</p>
                </div>
                <div className="review-board__actions">
                  <div className="review-when">
                    <span>{day}</span>
                    {time ? <strong>{time}</strong> : null}
                  </div>
                  <div className="rating-row cabinet-rating-row" aria-label={copy.common.ratingAria}>
                    <button>{copy.common.hard}</button>
                    <button>{copy.common.normal}</button>
                    <button>{copy.common.easy}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </CabinetPanel>
    </main>
  );
}
