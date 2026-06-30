import Link from "next/link";

import { getDictionary } from "../_content/i18n";
import { CabinetNav } from "./CabinetNav";
import { CabinetIcon } from "./_icons";

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

        <CabinetNav groups={copy.navGroups} ariaLabel={copy.navAria} />

        <Link className="cabinet-user" href="/settings" aria-label={copy.profile.menuAria}>
          <span className="cabinet-user__avatar" aria-hidden="true">
            {copy.profile.monogram}
          </span>
          <span className="cabinet-user__body">
            <span className="cabinet-user__name">{copy.profile.name}</span>
            <span className="cabinet-user__meta">{copy.profile.meta}</span>
            <span className="cabinet-user__plan">{copy.profile.plan}</span>
          </span>
          <CabinetIcon className="cabinet-user__chevron" name="selector" />
        </Link>
      </aside>

      <div className="cabinet-main">
        <header className="cabinet-topbar">
          <span className="cabinet-topbar__eyebrow">{copy.eyebrow}</span>
          <div className="cabinet-topbar__actions">
            <Link className="cabinet-topbar__link" href="/">
              {copy.backToMarketing}
            </Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
