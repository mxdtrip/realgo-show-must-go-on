import { CabinetPanel } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { cards } from "../_mock";
import { CardReviewSession } from "./_components/CardReviewSession";

export default function CardsPage() {
  const cabinetCopy = getDictionary().cabinet;
  const page = cabinetCopy.pages.cards;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      <CabinetPanel eyebrow={page.panelEyebrow} title={page.panelTitle}>
        <CardReviewSession
          cards={cards}
          copy={page.session}
          ratingLabels={{
            easy: cabinetCopy.common.easy,
            hard: cabinetCopy.common.hard,
            normal: cabinetCopy.common.normal,
          }}
        />
      </CabinetPanel>
    </main>
  );
}
