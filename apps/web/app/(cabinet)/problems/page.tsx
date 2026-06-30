import { CabinetPanel, StatusPill } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { problems } from "../_mock";

type Tone = "default" | "accent" | "success" | "warning" | "danger";

export default function ProblemsPage() {
  const page = getDictionary().cabinet.pages.problems;

  const statusMeta = new Map(page.statuses.map(([key, label, tone]) => [key, { label, tone }]));
  const summary = page.statuses.map(([key, label, tone]) => ({
    label,
    tone,
    count: problems.filter((problem) => problem.status === key).length,
  }));

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      <div className="cabinet-summary">
        <div className="cabinet-summary__total">
          <strong>{problems.length}</strong>
          <span>{page.summaryUnit}</span>
        </div>
        <div className="cabinet-summary__split">
          {summary.map((item) => (
            <span className={`review-type review-type--${item.tone}`} key={item.label}>
              {item.label}
              <em>{item.count}</em>
            </span>
          ))}
        </div>
      </div>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <div className="problem-list">
          {problems.map((problem) => {
            const meta = statusMeta.get(problem.status);
            return (
              <article className="problem-row" key={problem.title}>
                <div className="problem-row__main">
                  <strong>{problem.title}</strong>
                  <div className="problem-row__tags">
                    <span className="meta-chip">{problem.platform}</span>
                    <span className="meta-chip meta-chip--muted">{problem.pattern}</span>
                  </div>
                </div>
                <div className="problem-row__side">
                  <StatusPill tone={(meta?.tone ?? "default") as Tone}>{meta?.label ?? problem.status}</StatusPill>
                  <span className="problem-row__next">
                    <em>{page.nextLabel}</em>
                    {problem.next}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </CabinetPanel>
    </main>
  );
}
