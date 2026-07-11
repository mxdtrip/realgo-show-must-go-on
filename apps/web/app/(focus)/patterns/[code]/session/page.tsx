import { getDictionary } from "../../../../_content/i18n";
import { PatternSessionClient } from "./_components/PatternSessionClient";

export default async function PatternSessionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const dictionary = getDictionary();

  return (
    <PatternSessionClient
      code={code}
      brand={dictionary.cabinet.layout.brand}
      copy={dictionary.cabinet.pages.cards.session}
      emptyMessage={dictionary.cabinet.pages.patternDetail.sessionEmpty}
      errorFallback={dictionary.cabinet.pages.patternDetail.sessionError}
    />
  );
}
