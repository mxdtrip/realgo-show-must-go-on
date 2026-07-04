import { getDictionary } from "../../../_content/i18n";
import { PatternDetailPageClient } from "./_components/PatternDetailPageClient";

export default async function PatternDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const copy = getDictionary().cabinet.pages.patternDetail;

  return <PatternDetailPageClient code={code} copy={copy} />;
}
