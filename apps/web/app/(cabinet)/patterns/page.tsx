import { CabinetPanel, ProgressBar, StatusPill } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { weakPatterns } from "../_mock";

export default function PatternsPage() {
  const page = getDictionary().cabinet.pages.patterns;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <div className="pattern-grid">
          {weakPatterns.map((pattern) => (
            <article className="pattern-card" key={pattern.name}>
              <div>
                <strong>{pattern.name}</strong>
                <StatusPill tone={pattern.confidence < 45 ? "danger" : "warning"}>{pattern.confidence}%</StatusPill>
              </div>
              <ProgressBar value={pattern.confidence} label={`${pattern.name} confidence`} />
              <p>{pattern.signal}</p>
            </article>
          ))}
        </div>
      </CabinetPanel>
    </main>
  );
}
