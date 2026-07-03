import { getDictionary } from "../_content/i18n";

export function AuthPageHeader() {
  const dictionary = getDictionary();

  return (
    <header className="site-strip">
      <a className="site-brand" href="/" aria-label={dictionary.marketing.hero.homeAria}>
        {dictionary.common.brand}
      </a>
    </header>
  );
}
