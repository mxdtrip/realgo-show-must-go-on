import { getDictionary } from "../../_content/i18n";
import { ProblemsPageClient } from "./_components/ProblemsPageClient";

export default function ProblemsPage() {
  const page = getDictionary().cabinet.pages.problems;

  return <ProblemsPageClient copy={page} />;
}
