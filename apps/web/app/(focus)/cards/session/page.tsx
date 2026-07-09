import { cards } from "../../../(cabinet)/_mock";
import { getDictionary } from "../../../_content/i18n";
import { CardSessionClient } from "./_components/CardSessionClient";

export default function CardSessionPage() {
  const dictionary = getDictionary();
  const session = dictionary.cabinet.pages.cards.session;

  return (
    <CardSessionClient
      brand={dictionary.cabinet.layout.brand}
      copy={session}
      errorFallback={session.sessionError}
      mockCards={cards}
    />
  );
}
