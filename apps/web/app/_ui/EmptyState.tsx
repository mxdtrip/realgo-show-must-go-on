import type { ReactNode } from "react";

import { classNames, type UITone } from "./utils";

export type EmptyStateSurface = "panel" | "plain";
export type EmptyStateSize = "default" | "compact";
export type EmptyStateRole = "status" | "region" | "note" | "alert";

/**
 * Пустое состояние для списков и панелей кабинета.
 * `title` остаётся доступным именем блока, `description` и `action` опциональны.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "default",
  surface = "panel",
  size = "default",
  role = "status",
  ariaLabel,
  className,
}: Readonly<{
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: UITone;
  surface?: EmptyStateSurface;
  size?: EmptyStateSize;
  role?: EmptyStateRole;
  ariaLabel?: string;
  className?: string;
}>) {
  const live = role === "alert" ? "assertive" : role === "status" ? "polite" : undefined;

  return (
    <section
      className={classNames(
        "ui-empty-state",
        `ui-empty-state--${surface}`,
        `ui-empty-state--${size}`,
        `ui-empty-state--${tone}`,
        className,
      )}
      role={role}
      aria-label={ariaLabel ?? title}
      aria-live={live}
    >
      {icon ? (
        <span className="ui-empty-state__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="ui-empty-state__copy">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="ui-empty-state__action">{action}</div> : null}
    </section>
  );
}
