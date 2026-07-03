"use client";

import { usePathname } from "next/navigation";

/** Terminal-style breadcrumb: `~/realgo/dashboard`. */
export function CabinetPath({ prefix }: Readonly<{ prefix: string }>) {
  const pathname = usePathname();

  return (
    <span className="cabinet-path" aria-hidden="true">
      <em>{prefix}</em>
      {pathname}
    </span>
  );
}
