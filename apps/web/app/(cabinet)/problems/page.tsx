import { getDictionary } from "../../_content/i18n";
import { PracticeProgressClient } from "./_components/PracticeProgressClient";

export default function ProblemsPage() {
  const page = getDictionary().cabinet.pages.problems;

  return <PracticeProgressClient copy={page} />;
}
