import { CabinetPanel, StatusPill } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { reviewQueue } from "../_mock";

export default function ReviewsPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.reviews;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <div className="review-board">
          {reviewQueue.map((item) => (
            <article className="review-board__item" key={item.id}>
              <div>
                <span>{item.type}</span>
                <h2>{item.title}</h2>
                <p>{item.meta}</p>
              </div>
              <div className="review-board__actions">
                <StatusPill tone={item.rating === "hard" ? "warning" : "accent"}>{item.next}</StatusPill>
                <div className="rating-row cabinet-rating-row" aria-label={copy.common.ratingAria}>
                  <button>{copy.common.hard}</button>
                  <button>{copy.common.normal}</button>
                  <button>{copy.common.easy}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </CabinetPanel>
    </main>
  );
}
