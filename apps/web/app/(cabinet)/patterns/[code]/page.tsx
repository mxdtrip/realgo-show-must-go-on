import { getDictionary } from "../../../_content/i18n";
import { AtlasNodeClient } from "./_components/AtlasNodeClient";

export default async function PatternDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { pages } = getDictionary().cabinet;

  return <AtlasNodeClient code={code} copy={pages.atlasNode} atlasCopy={pages.atlas} />;
}
