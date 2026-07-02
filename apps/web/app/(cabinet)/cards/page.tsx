import Link from "next/link";

import { CabinetPanel } from "../_components";
import { CabinetIcon } from "../_icons";
import { getDictionary } from "../../_content/i18n";
import { cardRecords } from "../_mock";

export default function CardsPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.cards;
  const overview = page.overview;

  const mix = overview.types.map(([key, label]) => {
    const items = cardRecords.filter((card) => card.type === key);
    return {
      label,
      count: items.length,
      sources: items.map((card) => card.source.label.split(" · ")[0]).join(", "),
    };
  });

  return (
    <main className="cabinet-page cards-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <div className="cabinet-page-head__actions">
          <div>
            <Link className="cabinet-cta" href="/cards/session">
              {overview.start}
              <CabinetIcon name="arrow" />
            </Link>
          </div>
          <span className="cabinet-next-hint">
            <em>{cardRecords.length}</em> {overview.cardUnit} · {overview.estimatedTime}
          </span>
        </div>
      </section>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <div className="cards-launcher">
          <div className="cards-launcher__stack" aria-hidden="true">
            <i />
            <i />
            <i />
            <em>{cardRecords.length}</em>
          </div>
          <div className="cards-launcher__copy">
            <h2>{overview.readyTitle}</h2>
            <p>{overview.readyDescription}</p>
            <div className="cards-launcher__meta">
              <span>
                <b>{cardRecords.length}</b> {overview.cardUnit} {overview.dueLabel}
              </span>
              <span>{overview.estimatedTime}</span>
            </div>
          </div>
          <Link className="cabinet-cta" href="/cards/session">
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
