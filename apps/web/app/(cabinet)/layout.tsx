import Link from "next/link";

import { CabinetMobileNav } from "../_demo/CabinetMobileNav";
import { DemoBanner } from "../_demo/DemoBanner";
import { getDictionary } from "../_content/i18n";
import { CabinetGuard } from "./CabinetGuard";
import { CabinetInterviewCountdown } from "./CabinetInterviewCountdown";
import { CabinetNav } from "./CabinetNav";
import { LogoutButton } from "./LogoutButton";

export default function CabinetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const dictionary = getDictionary();
  const copy = dictionary.cabinet.layout;
  const profileCopy = dictionary.cabinet.pages.settings.profile;

  return (
    <CabinetGuard>
      <a className="cabinet-skip-link" href="#cabinet-content">
        Перейти к содержимому
      </a>
      <div className="cabinet-shell">
        <aside className="cabinet-sidebar">
          <div className="cabinet-brand-block">
            <Link className="site-brand" href="/">
              {dictionary.common.brand}
            </Link>
            <CabinetInterviewCountdown
              copy={copy.profile.interview}
              defaultInterviewDate={profileCopy.interviewDate}
              defaultTimezone={profileCopy.timezone}
            />
          </div>

          <CabinetNav groups={copy.navGroups} ariaLabel={copy.navAria} />
        </aside>

        <div className="cabinet-main">
          <DemoBanner />
          <header className="cabinet-topbar">
            <CabinetMobileNav
              ariaLabel={copy.navAria}
              brand={dictionary.common.brand}
              defaultInterviewDate={profileCopy.interviewDate}
              defaultTimezone={profileCopy.timezone}
              groups={copy.navGroups}
              interviewCopy={copy.profile.interview}
            />
            <span className="cabinet-topbar__eyebrow">{copy.eyebrow}</span>
            <div className="cabinet-topbar__actions">
              <Link className="cabinet-topbar__link" href="/">
                {copy.backToMarketing}
              </Link>
              <LogoutButton label="Выйти" />
            </div>
          </header>
          <div className="cabinet-content" id="cabinet-content" tabIndex={-1}>
            {children}
          </div>
        </div>
      </div>
    </CabinetGuard>
  );
}
