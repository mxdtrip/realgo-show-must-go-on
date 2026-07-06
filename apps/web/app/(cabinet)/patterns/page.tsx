import { getDictionary } from "../../_content/i18n";
import { PatternAtlasClient } from "./_components/PatternAtlasClient";

export default function PatternsPage() {
  const copy = getDictionary().cabinet.pages.atlas;

  return <PatternAtlasClient copy={copy} />;
}
