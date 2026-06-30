import { CabinetPanel, ProgressBar, StatusPill } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { weakPatterns } from "../_mock";

export default function PatternsPage() {
  const page = getDictionary().cabinet.pages.patterns;

  const ranked = [...weakPatterns].sort((a, b) => a.confidence - b.confidence);
  const needAttention = ranked.filter((pattern) => pattern.confidence < 60).length;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      <div className="cabinet-summary">
        <div className="cabinet-summary__total">
          <strong>{needAttention}</strong>
          <span>{page.summaryUnit}</span>
        </div>
        <div className="cabinet-summary__split">
          <span className="review-type review-type--warning">
            {ranked[0]?.name}
            <em>{ranked[0]?.confidence}%</em>
          </span>
        </div>
      </div>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <div className="pattern-grid">
          {ranked.map((pattern) => {
            const severe = pattern.confidence < 45;
            return (
              <article className="pattern-card" key={pattern.name}>
                <div className="pattern-card__head">
                  <div>
                    <strong>{pattern.name}</strong>
                    <span className="pattern-card__priority">
                      {severe ? page.priorityHigh : page.priorityMed}
                    </span>
                  </div>
                  <StatusPill tone={severe ? "danger" : "warning"}>{pattern.confidence}%</StatusPill>
                </div>
                <div className="pattern-card__meter">
                  <span>{page.confidenceLabel}</span>
                  <ProgressBar
                    value={pattern.confidence}
                    tone={severe ? "danger" : "warning"}
                    label={`${pattern.name} confidence`}
                  />
                </div>
                <p>{pattern.signal}</p>
              </article>
            );
          })}
        </div>
      </CabinetPanel>
    </main>
  );
}
