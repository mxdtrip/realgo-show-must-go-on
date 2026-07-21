import type { Metadata } from "next";

import { getDictionary } from "../../_content/i18n";
import { PracticeProgressClient } from "./_components/PracticeProgressClient";

export const metadata: Metadata = { title: "Практика" };

export default function ProblemsPage() {
  const page = getDictionary().cabinet.pages.problems;

  return <PracticeProgressClient copy={page} />;
}
