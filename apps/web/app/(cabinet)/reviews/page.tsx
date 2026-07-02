import { getDictionary } from "../../_content/i18n";
import { ReviewsPageClient } from "./_components/ReviewsPageClient";

export default function ReviewsPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.reviews;

  return (
    <ReviewsPageClient
      copy={{
        startSession: copy.common.startSession,
        hard: copy.common.hard,
        normal: copy.common.normal,
        easy: copy.common.easy,
        page,
      }}
    />
  );
}
