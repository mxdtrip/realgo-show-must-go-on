import { getDictionary } from "../../_content/i18n";
import { ReviewsJournalClient } from "./_components/ReviewsJournalClient";

export default function ReviewsPage() {
  const page = getDictionary().cabinet.pages.reviews;

  return <ReviewsJournalClient copy={page.journal} />;
}
