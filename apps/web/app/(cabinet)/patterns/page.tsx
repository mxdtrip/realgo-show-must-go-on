import { CabinetPanel, ProgressBar, StatusPill } from "../_components";
import { weakPatterns } from "../_mock";

export default function PatternsPage() {
  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">/patterns</span>
        <h1>Паттерны и confidence</h1>
        <p>Сводка слабых тем, чтобы кабинет подсказывал не просто “реши ещё”, а что именно закрепить.</p>
      </section>

      <CabinetPanel eyebrow="weak spots" title="Pattern confidence">
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
