import Link from "next/link";

import { CabinetPanel, StatusPill } from "../_components";
import { getDictionary } from "../../_content/i18n";

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
        <div className="cards-overview">
          <div>
            <span className="cabinet-eyebrow">{page.overview.readyEyebrow}</span>
            <h2>{page.overview.readyTitle}</h2>
            <p>{page.overview.readyDescription}</p>
            <div className="cards-overview__meta">
              <StatusPill tone="accent">{page.overview.cardsCount}</StatusPill>
              <StatusPill>{page.overview.estimatedTime}</StatusPill>
            </div>
          </div>
          <Link className="cards-overview__start" href="/cards/session">
            {page.overview.start}
          </Link>
        </div>
      </CabinetPanel>

      <CabinetPanel eyebrow={page.overview.methodEyebrow} title={page.overview.methodTitle}>
        <div className="cards-method">
          {page.overview.methodSteps.map(([number, title, description]) => (
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
