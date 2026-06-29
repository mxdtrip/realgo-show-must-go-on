import { CabinetPanel } from "../_components";
import { cards } from "../_mock";

export default function CardsPage() {
  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">/cards</span>
        <h1>Карточки повторения</h1>
        <p>Стартовая структура карточек Type A/B/C: без готового кода, только паттерн, механика и edge cases.</p>
      </section>

      <CabinetPanel eyebrow="anki-like" title="Today cards">
        <div className="cabinet-card-grid">
          {cards.map((card) => (
            <article className="memory-card" key={card.type}>
              <span>{card.type}</span>
              <h2>{card.front}</h2>
              <p>{card.back}</p>
            </article>
          ))}
        </div>
      </CabinetPanel>
    </main>
  );
}
