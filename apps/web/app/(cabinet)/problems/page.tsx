import { getDictionary } from "../../_content/i18n";
import { problems } from "../_mock";
import { ProblemsTable } from "./_components/ProblemsTable";

export default function ProblemsPage() {
  const page = getDictionary().cabinet.pages.problems;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
        <div className="cabinet-page-head__actions">
          <span className="cabinet-next-hint">
            <em>{problems.length}</em> {page.summaryUnit}
          </span>
        </div>
      </section>

      <ProblemsTable
        items={problems}
        statuses={page.statuses}
        copy={{
          filterAll: page.filterAll,
          searchPlaceholder: page.searchPlaceholder,
          searchAria: page.searchAria,
          panelEyebrow: page.panelEyebrow,
          panelTitle: page.panelTitle,
          empty: page.empty,
          columns: page.columns,
        }}
      />
    </main>
  );
}
