import { getDictionary } from "../../_content/i18n";
import { CardsPageClient } from "./_components/CardsPageClient";

export default function CardsPage() {
  const page = getDictionary().cabinet.pages.cards;

  return <CardsPageClient copy={page.deck} />;
}
