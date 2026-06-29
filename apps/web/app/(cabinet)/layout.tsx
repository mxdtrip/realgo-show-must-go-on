import Link from "next/link";

import { getDictionary } from "../_content/i18n";

export default function CabinetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const dictionary = getDictionary();
  const copy = dictionary.cabinet.layout;

  return (
    <div className="cabinet-shell">
      <aside className="cabinet-sidebar">
        <Link className="site-brand" href="/">
          {dictionary.common.brand}
        </Link>
        <nav className="cabinet-nav" aria-label={copy.navAria}>
          {copy.nav.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="cabinet-sidebar__note">
          <span>{copy.mockMode}</span>
          <p>{copy.mockNote}</p>
        </div>
      </aside>

      <div className="cabinet-main">
        <header className="cabinet-topbar">
          <div>
            <span>{copy.eyebrow}</span>
            <strong>{copy.target}</strong>
          </div>
          <Link className="cabinet-topbar__link" href="/">
            {copy.backToMarketing}
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
