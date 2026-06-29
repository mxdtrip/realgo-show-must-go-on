import { CabinetPanel } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { cards } from "../_mock";

export default function CardsPage() {
  const page = getDictionary().cabinet.pages.cards;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
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
