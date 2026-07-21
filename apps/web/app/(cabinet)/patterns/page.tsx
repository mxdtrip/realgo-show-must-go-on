import type { Metadata } from "next";

import { getDictionary } from "../../_content/i18n";
import { PatternAtlasClient } from "./_components/PatternAtlasClient";

export const metadata: Metadata = { title: "Pattern Atlas" };

export default function PatternsPage() {
  const copy = getDictionary().cabinet.pages.atlas;

  return <PatternAtlasClient copy={copy} />;
}
