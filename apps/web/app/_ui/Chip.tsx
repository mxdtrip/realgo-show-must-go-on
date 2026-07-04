import type { ReactNode } from "react";

import { classNames, type UITone } from "./utils";

export type ChipTone = UITone;

/**
 * Чип с декоративной точкой-индикатором, совместимый по тону с `review-type`.
 */
export function Chip({
  children,
  tone = "default",
  ariaLabel,
  className,
}: Readonly<{
  children: ReactNode;
  tone?: ChipTone;
  ariaLabel?: string;
  className?: string;
}>) {
  return (
    <span className={classNames("ui-chip", `ui-chip--${tone}`, className)} aria-label={ariaLabel}>
      {children}
    </span>
  );
}
