"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CabinetPanel } from "../_components";
import { CabinetIcon } from "../_icons";
import { getDictionary } from "../../_content/i18n";
import { getCardSession } from "../../_api/cards";
import { cardRecords } from "../_mock";

type LiveStats = {
  dueCount: number;
  estimatedMinutes: number;
};

export default function CardsPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.cards;
  const overview = page.overview;

  // Live numbers from GET /me/cards/session; null keeps the mock demo values
  // (unauthenticated visitors, stopped backend).
  const [live, setLive] = useState<LiveStats | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getCardSession({ scope: "due" }, controller.signal)
      .then((session) => {
        setLive({ dueCount: session.cards.length, estimatedMinutes: session.estimatedMinutes });
      })
      .catch(() => {
        // Demo fallback: keep the mock counts.
      });
    return () => controller.abort();
  }, []);

  const dueCount = live?.dueCount ?? cardRecords.length;
  const estimatedTime = live ? `~${live.estimatedMinutes} ${overview.minuteUnit}` : overview.estimatedTime;

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
            <em>{dueCount}</em> {overview.cardUnit} · {estimatedTime}
          </span>
        </div>
      </section>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <div className="cards-launcher">
          <div className="cards-launcher__stack" aria-hidden="true">
            <i />
            <i />
            <i />
            <em>{dueCount}</em>
          </div>
          <div className="cards-launcher__copy">
            <h2>{overview.readyTitle}</h2>
            <p>{overview.readyDescription}</p>
            <div className="cards-launcher__meta">
              <span>
                <b>{dueCount}</b> {overview.cardUnit} {overview.dueLabel}
              </span>
              <span>{estimatedTime}</span>
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
