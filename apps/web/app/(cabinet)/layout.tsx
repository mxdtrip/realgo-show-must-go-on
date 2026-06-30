import Link from "next/link";

import { getDictionary } from "../_content/i18n";
import { CabinetGuard } from "./CabinetGuard";
import { CabinetNav } from "./CabinetNav";
import { CabinetInterviewCountdown } from "./CabinetInterviewCountdown";
import { LogoutButton } from "./LogoutButton";

export default function CabinetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const dictionary = getDictionary();
  const copy = dictionary.cabinet.layout;

  return (
    <CabinetGuard>
      <div className="cabinet-shell">
      <aside className="cabinet-sidebar">
        <div className="cabinet-brand-block">
          <Link className="site-brand" href="/">
            {dictionary.common.brand}
          </Link>
          <CabinetInterviewCountdown
            copy={copy.profile.interview}
            defaultInterviewDate={dictionary.cabinet.pages.settings.profile.interviewDate}
            defaultTimezone={dictionary.cabinet.pages.settings.profile.timezone}
          />
        </div>

        <CabinetNav groups={copy.navGroups} ariaLabel={copy.navAria} />
      </aside>

      <div className="cabinet-main">
        <header className="cabinet-topbar">
          <span className="cabinet-topbar__eyebrow">{copy.eyebrow}</span>
          <div className="cabinet-topbar__actions">
            <Link className="cabinet-topbar__link" href="/">
              {copy.backToMarketing}
            </Link>
            <LogoutButton label="Выйти" />
          </div>
        </header>
        {children}
      </div>
      </div>
    </CabinetGuard>
  );
}
