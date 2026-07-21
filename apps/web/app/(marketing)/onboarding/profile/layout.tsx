import type { Metadata } from "next";

// page.tsx is a client component ("use client"), which can't export
// metadata itself — a thin layout is the standard way to attach a <title>
// to a route whose page is client-rendered.
export const metadata: Metadata = { title: "Онбординг" };

export default function OnboardingProfileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
