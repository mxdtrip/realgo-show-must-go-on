import type { Metadata } from "next";

import { getDictionary } from "../../../_content/i18n";
import { titleFromPatternCode } from "../../../_ui/utils";
import { AtlasNodeClient } from "./_components/AtlasNodeClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return { title: titleFromPatternCode(code) };
}

export default async function PatternDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { pages } = getDictionary().cabinet;

  return <AtlasNodeClient code={code} copy={pages.atlasNode} atlasCopy={pages.atlas} />;
}
