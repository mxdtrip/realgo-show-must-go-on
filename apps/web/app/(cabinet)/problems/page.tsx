import { CabinetPanel, StatusPill } from "../_components";
import { problems } from "../_mock";

export default function ProblemsPage() {
  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">/problems</span>
        <h1>Личная база задач</h1>
        <p>Здесь будут задачи, сохранённые расширением или вручную. Сейчас — статичный мок без backend.</p>
      </section>

      <CabinetPanel eyebrow="library" title="Saved problems">
        <div className="cabinet-table">
          <div className="cabinet-table__row cabinet-table__row--head">
            <span>task</span>
            <span>platform</span>
            <span>pattern</span>
            <span>status</span>
            <span>next review</span>
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
