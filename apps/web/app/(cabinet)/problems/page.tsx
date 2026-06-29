import { CabinetPanel, StatusPill } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { problems } from "../_mock";

export default function ProblemsPage() {
  const page = getDictionary().cabinet.pages.problems;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <div className="cabinet-table">
          <div className="cabinet-table__row cabinet-table__row--head">
            {page.tableHead.map((heading) => (
              <span key={heading}>{heading}</span>
            ))}
          </div>
          {problems.map((problem) => (
            <div className="cabinet-table__row" key={problem.title}>
              <strong>{problem.title}</strong>
              <span>{problem.platform}</span>
              <span>{problem.pattern}</span>
              <StatusPill tone={problem.status === "mastered" ? "success" : "accent"}>{problem.status}</StatusPill>
              <span>{problem.next}</span>
            </div>
          ))}
        </div>
      </CabinetPanel>
    </main>
  );
}
