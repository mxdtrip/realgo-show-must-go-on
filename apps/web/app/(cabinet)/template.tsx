export default function CabinetTemplate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Next remounts the template on every in-cabinet navigation, so the wrapper
  // replays the page-in animation; prefers-reduced-motion disables it in CSS.
  return <div className="cabinet-page-in">{children}</div>;
}
