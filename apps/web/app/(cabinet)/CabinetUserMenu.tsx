"use client";

import { AccountUserMenu, type AccountMenuCopy } from "../components/AccountUserMenu";
import { openReportProblemDialog } from "./ReportProblemDialog";

export function CabinetUserMenu({ copy }: { copy: AccountMenuCopy }) {
  return <AccountUserMenu copy={copy} onReport={openReportProblemDialog} />;
}
