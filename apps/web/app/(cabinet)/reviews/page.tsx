import { CabinetIcon } from "../_icons";
import { CabinetPanel } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { reviewQueue } from "../_mock";

/** Type → cabinet icon glyph (reuses the shared inline icon family). */
const iconByType: Record<string, string> = {
  "problem review": "problems",
  card: "cards",
  "pattern review": "patterns",
};

/** FSRS rating → existing tone token (blue / green / amber). */
const ratingTone: Record<string, string> = {
  normal: "accent",
  easy: "success",
  hard: "warning",
};

export default function ReviewsPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.reviews;

  const toneByType = new Map(page.types.map(([key, , tone]) => [key, tone]));
  const summary = page.types.map(([key, label, tone]) => ({
    key,
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
        <div className="review-stat">
          <span className="review-stat__icon">
            <CabinetIcon name="reviews" />
          </span>
          <div className="review-stat__body">
            <strong>{reviewQueue.length}</strong>
            <span>{page.summaryUnit}</span>
          </div>
        </div>
        {summary.map((item) => (
          <div className={`review-stat review-stat--${item.tone}`} key={item.key}>
            <span className="review-stat__icon">
              <CabinetIcon name={iconByType[item.key] ?? "reviews"} />
            </span>
            <div className="review-stat__body">
              <strong>{item.count}</strong>
              <span>{item.label}</span>
            </div>
          </div>
        ))}
      </div>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <div className="review-board">
          {reviewQueue.map((item) => {
            const [day, time] = item.next.split(" · ");
            const tone = toneByType.get(item.type) ?? "accent";
            const badgeTone = ratingTone[item.rating] ?? "accent";
            return (
              <article className="review-board__item" key={item.id}>
                <span className={`review-board__icon review-board__icon--${tone}`}>
                  <CabinetIcon name={iconByType[item.type] ?? "reviews"} />
                </span>
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
                  <span className={`review-badge review-badge--${badgeTone}`}>
                    {item.rating}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </CabinetPanel>
    </main>
  );
}
