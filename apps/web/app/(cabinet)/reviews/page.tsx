import { getDictionary } from "../../_content/i18n";
import { ReviewsJournalClient } from "./_components/ReviewsJournalClient";
import { ReviewQueueClient } from "./_components/ReviewQueueClient";

export default function ReviewsPage() {
  const page = getDictionary().cabinet.pages.reviews;

  return <ReviewsJournalClient copy={page.journal} queue={<ReviewQueueClient copy={page.queue} />} />;
}
