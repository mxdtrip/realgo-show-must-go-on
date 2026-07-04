import type { ReactNode } from "react";

import { classNames, type UITone } from "./utils";

export type BadgeTone = UITone;

/**
 * Компактный текстовый бейдж для статусов и метаданных.
 */
export function Badge({
  children,
  tone = "default",
  ariaLabel,
  className,
}: Readonly<{
  children: ReactNode;
  tone?: BadgeTone;
  ariaLabel?: string;
  className?: string;
}>) {
  return (
    <span className={classNames("ui-badge", `ui-badge--${tone}`, className)} aria-label={ariaLabel}>
      {children}
    </span>
  );
}
