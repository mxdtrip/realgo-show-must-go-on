const AUTH_BYPASS = process.env.NEXT_PUBLIC_AUTH_BYPASS === "1";

/** Compact topbar badge shown only when the auth bypass (demo mode) is active. */
export function DemoBanner({ label, title }: Readonly<{ label: string; title: string }>) {
  if (!AUTH_BYPASS) {
    return null;
  }

  return (
    <span className="demo-badge" title={title}>
      {label}
    </span>
  );
}
