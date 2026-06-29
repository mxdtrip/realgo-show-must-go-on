import { CabinetPanel, StatusPill } from "../_components";
import { reviewQueue } from "../_mock";

export default function ReviewsPage() {
  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">/reviews</span>
        <h1>Очередь повторений</h1>
        <p>Моковый список того, что пользователь должен повторить сегодня: задачи, паттерны и карточки.</p>
      </section>

      <CabinetPanel eyebrow="today" title="Review queue">
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
                <div className="rating-row cabinet-rating-row" aria-label="Mock review rating">
                  <button>hard</button>
                  <button>normal</button>
                  <button>easy</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </CabinetPanel>
    </main>
  );
}
