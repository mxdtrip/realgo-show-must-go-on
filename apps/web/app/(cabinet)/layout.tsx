import Link from "next/link";

import { CabinetMobileNav } from "../_demo/CabinetMobileNav";
import { DemoBanner } from "../_demo/DemoBanner";
import { getDictionary } from "../_content/i18n";
import { CabinetDueChip } from "./CabinetDueChip";
import { CabinetGuard } from "./CabinetGuard";
import { CabinetHotkeys } from "./CabinetHotkeys";
import { CabinetInterviewCountdown } from "./CabinetInterviewCountdown";
import { CabinetNav } from "./CabinetNav";
import { CabinetPath } from "./CabinetPath";
import { CabinetUserMenu } from "./CabinetUserMenu";
import { CabinetWelcomeTour } from "./CabinetWelcomeTour";
import { ReportProblemLauncher } from "./ReportProblemDialog";

export default function CabinetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const dictionary = getDictionary();
  const copy = dictionary.cabinet.layout;
  const shellCopy = dictionary.cabinet.shell;
  const profileCopy = dictionary.cabinet.pages.settings.profile;

  return (
    <CabinetGuard>
      <a className="cabinet-skip-link" href="#cabinet-content">
        Перейти к содержимому
      </a>
      <div className="cabinet-shell">
        <aside className="cabinet-sidebar" data-tour="nav">
          <div className="cabinet-brand-block">
            <Link className="site-brand" href="/dashboard">
              {copy.brand}
            </Link>
            <CabinetInterviewCountdown
              copy={copy.profile.interview}
              defaultInterviewDate={profileCopy.interviewDate}
              defaultTimezone={profileCopy.timezone}
            />
          </div>

          <CabinetNav groups={copy.navGroups} ariaLabel={copy.navAria} />

          <CabinetUserMenu copy={copy.account} />
        </aside>

        <div className="cabinet-main">
          <header className="cabinet-topbar">
            <CabinetMobileNav
              ariaLabel={copy.navAria}
              brand={copy.brand}
              defaultInterviewDate={profileCopy.interviewDate}
              defaultTimezone={profileCopy.timezone}
              groups={copy.navGroups}
              interviewCopy={copy.profile.interview}
            />
            <CabinetPath prefix={copy.pathPrefix} />
            <div className="cabinet-topbar__actions">
              <DemoBanner label={copy.demoBadge} title={copy.demoTitle} />
              <ReportProblemLauncher copy={shellCopy.report} />
              <CabinetDueChip label={copy.dueChip} />
              <Link className="cabinet-topbar__link cabinet-topbar__back" href="/">
                {copy.backToMarketing}
              </Link>
            </div>
          </header>
          <div className="cabinet-content" id="cabinet-content" data-tour="content" tabIndex={-1}>
            {children}
          </div>
        </div>
      </div>
      <CabinetHotkeys copy={shellCopy.hotkeys} />
      <CabinetWelcomeTour copy={shellCopy.tour} />
    </CabinetGuard>
  );
}
