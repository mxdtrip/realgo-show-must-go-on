import { CabinetGuard } from "../(cabinet)/CabinetGuard";

export default function FocusLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The focus space hosts the flashcard review session (/cards/session), which
  // is cabinet-only data. Tokens live in localStorage, so gate it client-side
  // with the same guard as the cabinet — otherwise the route is reachable
  // anonymously (unlike every /(cabinet) route).
  return (
    <CabinetGuard>
      <div className="focus-space">{children}</div>
    </CabinetGuard>
  );
}
