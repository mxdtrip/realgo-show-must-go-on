import { FocusCardReviewSession } from "../../../(cabinet)/cards/_components/FocusCardReviewSession";
import { cards } from "../../../(cabinet)/_mock";
import { getDictionary } from "../../../_content/i18n";

export default function CardSessionPage() {
  const dictionary = getDictionary();

  return (
    <FocusCardReviewSession
      brand={dictionary.common.brand}
      cards={cards}
      copy={dictionary.cabinet.pages.cards.session}
    />
  );
}
