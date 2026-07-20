"use client";

import { useAuth } from "../_api/AuthProvider";
import { ReportProblemLauncher, openReportProblemDialog } from "../(cabinet)/ReportProblemDialog";
import { getDictionary } from "../_content/i18n";
import { AccountUserMenu } from "./AccountUserMenu";

export function SiteHeader() {
  const dictionary = getDictionary();
  const copy = dictionary.marketing.hero;
  const auth = useAuth();
  const isAuthenticated = auth.status === "authenticated" && auth.user;

  return (
    <header className="site-strip">
      <a className="site-brand" href="/" aria-label={copy.homeAria}>
        {dictionary.common.brand}
      </a>
      <div className={isAuthenticated ? "site-auth site-auth--authenticated" : "site-auth"}>
        {isAuthenticated ? (
          <>
            <AccountUserMenu
              className="site-user-panel"
              copy={dictionary.cabinet.layout.account}
              onReport={openReportProblemDialog}
            />
            <a className="site-auth__dashboard" href="/dashboard">
              {copy.auth.dashboard}
            </a>
            <ReportProblemLauncher copy={dictionary.cabinet.shell.report} showTrigger={false} />
          </>
        ) : (
          <>
            <a className="site-auth__cta" href="/login">
              {copy.auth.login}
            </a>
            <a className="site-auth__cta" href="/register">
              {copy.auth.signup}
            </a>
          </>
        )}
      </div>
    </header>
  );
}
