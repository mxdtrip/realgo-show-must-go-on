import Link from "next/link";

import { CabinetPanel } from "../_components";
import { CabinetIcon } from "../_icons";
import { getDictionary } from "../../_content/i18n";
import { cards } from "../_mock";

export default function CardsPage() {
  const page = getDictionary().cabinet.pages.cards;
  const overview = page.overview;

  const mix = overview.types.map(([key, label]) => {
    const items = cards.filter((card) => card.type === key);
    return {
      label,
      count: items.length,
      sources: items.map((card) => card.source.split(" · ")[0]).join(", "),
    };
  });

  return (
    <main className="cabinet-page cards-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <div className="cards-overview">
          <div>
            <span className="cabinet-eyebrow">{overview.readyEyebrow}</span>
            <h2>{overview.readyTitle}</h2>
            <p>{overview.readyDescription}</p>
            <div className="cards-overview__meta">
              <span className="cards-overview__stat">
                <strong>{cards.length}</strong>
                {overview.cardUnit}
              </span>
              <span className="cards-overview__stat cards-overview__stat--muted">
                {overview.estimatedTime}
              </span>
            </div>
          </div>
          <Link className="cards-overview__start" href="/cards/session">
            {overview.start}
            <CabinetIcon name="arrow" />
          </Link>
        </div>
      </CabinetPanel>

      <CabinetPanel eyebrow={overview.mixEyebrow} title={overview.mixTitle}>
        <div className="cards-mix">
          {mix.map((group) => (
            <article className="cards-mix__type" key={group.label}>
              <div className="cards-mix__count">
                <strong>{group.count}</strong>
                <span>{overview.cardUnit}</span>
              </div>
              <strong className="cards-mix__label">{group.label}</strong>
              <p>{group.sources}</p>
            </article>
          ))}
        </div>
      </CabinetPanel>

      <CabinetPanel eyebrow={overview.methodEyebrow} title={overview.methodTitle}>
        <div className="cards-method">
          {overview.methodSteps.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </CabinetPanel>
    </main>
  );
}
