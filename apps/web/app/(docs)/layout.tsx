import type { ReactNode } from "react";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { DocsPagerNav } from "./DocsPagerNav";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <DocsPagerNav />
      {children}
      <SiteFooter />
    </>
  );
}
