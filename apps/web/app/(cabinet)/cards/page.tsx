"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CabinetPanel } from "../_components";
import { CabinetIcon } from "../_icons";
import { getDictionary } from "../../_content/i18n";
import { getDueSummary, type DueSummary } from "../../_api/cards";

type SummaryState = "loading" | "loaded" | "error";

export default function CardsPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.cards;
  const overview = page.overview;

  // Live numbers from GET /me/cards/due-summary (un-capped, unlike the
  // review-session endpoint). An outage is explicit: never present demo
  // records as if they belonged to the signed-in user.
  const [live, setLive] = useState<DueSummary | null>(null);
  const [summaryState, setSummaryState] = useState<SummaryState>("loading");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setSummaryState("loading");
    getDueSummary(controller.signal)
      .then((summary) => {
        setLive(summary);
        setSummaryState("loaded");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLive(null);
          setSummaryState("error");
        }
      });
    return () => controller.abort();
  }, [reloadVersion]);

  const dueCount = live ? String(live.totalDue) : "—";
  const estimatedTime = live ? `~${live.estimatedMinutes} ${overview.minuteUnit}` : "—";

  const mix = overview.types.map(([key, label]) => {
    if (live) {
      const entry = live.byType.find((item) => item.type === key);
      const count = entry?.count ?? 0;
      const shown = entry?.sampleLabels.map((source) => source.split(" · ")[0]) ?? [];
      const hidden = count - shown.length;
      const sources = hidden > 0 ? [...shown, `+${hidden}`].join(", ") : shown.join(", ");
      return { label, count, sources };
    }
    return {
      label,
      count: "—",
      sources: summaryState === "loading" ? page.session.loading : "",
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

      {summaryState === "error" ? (
        <div className="cards-summary-error" role="alert">
          <span>{page.session.sessionError}</span>
          <button type="button" onClick={() => setReloadVersion((version) => version + 1)}>
            {page.session.retry}
          </button>
        </div>
      ) : null}

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
