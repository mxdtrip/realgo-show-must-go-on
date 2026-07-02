import Link from "next/link";

import { CabinetIcon } from "../_icons";
import { getDictionary } from "../../_content/i18n";
import { reviewQueue } from "../_mock";
import { ReviewsBoard } from "./_components/ReviewsBoard";

export default function ReviewsPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.reviews;

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
            <em>{reviewQueue.length}</em> {page.summaryUnit}
          </span>
        </div>
      </section>

      <ReviewsBoard
        items={reviewQueue}
        types={page.types}
        copy={{
          filterAll: page.filterAll,
          panelEyebrow: page.panelEyebrow,
          panelTitle: page.panelTitle,
          summaryUnit: page.summaryUnit,
          empty: page.empty,
        }}
      />
    </main>
  );
}
