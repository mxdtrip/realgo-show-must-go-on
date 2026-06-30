import Link from "next/link";

import { getDictionary } from "../_content/i18n";
import { CabinetNav } from "./CabinetNav";
import { CabinetProfileLink } from "./CabinetProfileLink";

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

        <CabinetProfileLink
          copy={copy.profile}
          defaultInterviewDate={dictionary.cabinet.pages.settings.profile.interviewDate}
          defaultTimezone={dictionary.cabinet.pages.settings.profile.timezone}
        />
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
