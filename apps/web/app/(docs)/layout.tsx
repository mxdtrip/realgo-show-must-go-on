import type { ReactNode } from "react";
import { AuthPageHeader } from "../_auth/AuthPageHeader";
import { SiteFooter } from "../components/SiteFooter";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthPageHeader />
      {children}
      <SiteFooter />
    </>
  );
}
