import Link from "next/link";

import { CabinetPanel, ProgressBar } from "../_components";
import { CabinetIcon } from "../_icons";
import { getDictionary } from "../../_content/i18n";
import { weakPatterns } from "../_mock";

export default function PatternsPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.patterns;

  const ranked = [...weakPatterns].sort((a, b) => a.confidence - b.confidence);
  const needAttention = ranked.filter((pattern) => pattern.confidence < 60).length;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <div className="cabinet-page-head__actions">
          <div>
            <Link className="cabinet-cta" href="/cards/session">
              {copy.common.startSession}
              <CabinetIcon name="arrow" />
            </Link>
          </div>
          <span className="cabinet-next-hint">
            <em>{needAttention}</em> {page.summaryUnit}
          </span>
        </div>
      </section>

      <CabinetPanel
        eyebrow={page.panelEyebrow}
        title={page.panelTitle}
        meta={<span className="cabinet-panel__meta">{ranked.length} patterns</span>}
      >
        <div className="pattern-grid">
          {ranked.map((pattern) => {
            const severe = pattern.confidence < 45;
            const trendUp = pattern.trend > 0;
            return (
              <article className="pattern-card" key={pattern.name}>
                <div className="pattern-card__head">
                  <div>
                    <strong>{pattern.name}</strong>
                    <span className="pattern-card__priority">
                      {severe ? page.priorityHigh : page.priorityMed}
                    </span>
                  </div>
                  <div className="pattern-card__score">
                    <strong className={severe ? "confidence--danger" : "confidence--warning"}>
                      {pattern.confidence}%
                    </strong>
                    <em className={trendUp ? "is-up" : "is-down"}>
                      {trendUp ? `+${pattern.trend}` : `−${-pattern.trend}`} {page.weeklyLabel}
                    </em>
                  </div>
                </div>
                <ProgressBar
                  value={pattern.confidence}
                  tone={severe ? "danger" : "warning"}
                  label={`${pattern.name} confidence`}
                />
                <p>{pattern.signal}</p>
                <div className="pattern-card__foot">
                  <Link href="/cards/session">{page.trainLink}</Link>
                </div>
              </article>
            );
          })}
        </div>
      </CabinetPanel>
    </main>
  );
}
