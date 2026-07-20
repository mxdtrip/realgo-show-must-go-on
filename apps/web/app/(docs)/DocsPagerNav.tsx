"use client";

import { usePathname } from "next/navigation";
import { docsNavOrder } from "./_docsNav";

export function DocsPagerNav() {
  const pathname = usePathname();
  const index = docsNavOrder.findIndex((entry) => entry.href === pathname);
  if (index === -1) return null;

  const prev = index > 0 ? docsNavOrder[index - 1] : null;
  const next = index < docsNavOrder.length - 1 ? docsNavOrder[index + 1] : null;

  return (
    <nav className="docs-pager" aria-label="Навигация по документам">
      {prev ? (
        <a className="docs-pager__prev" href={prev.href}>
          <span className="docs-pager__arrow" aria-hidden="true">
            ←
          </span>
          {prev.title}
        </a>
      ) : (
        <span />
      )}
      <a className="docs-pager__home" href="/">
        Вернуться на главную
      </a>
      {next ? (
        <a className="docs-pager__next" href={next.href}>
          {next.title}
          <span className="docs-pager__arrow" aria-hidden="true">
            →
          </span>
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}
