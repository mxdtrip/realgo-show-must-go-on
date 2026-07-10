import { cards } from "../../../(cabinet)/_mock";
import { getDictionary } from "../../../_content/i18n";
import { CardSessionClient } from "./_components/CardSessionClient";

export default async function CardSessionPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ scope?: string }> }>) {
  const dictionary = getDictionary();
  const session = dictionary.cabinet.pages.cards.session;
  const { scope } = await searchParams;

  return (
    <CardSessionClient
      brand={dictionary.cabinet.layout.brand}
      copy={session}
      errorFallback={session.sessionError}
      mockCards={cards}
      scope={scope === "practice" ? "practice" : "due"}
    />
  );
}
