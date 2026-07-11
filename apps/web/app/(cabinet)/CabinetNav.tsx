"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CabinetIcon } from "./_icons";

export type CabinetNavItem = Readonly<{ href: string; label: string; icon: string; count: string }>;
export type CabinetNavGroup = Readonly<{ title: string; items: readonly CabinetNavItem[] }>;

export function CabinetNav({
  groups,
  ariaLabel,
  onNavigate,
}: Readonly<{ groups: readonly CabinetNavGroup[]; ariaLabel: string; onNavigate?: () => void }>) {
  const pathname = usePathname();

  return (
    <nav className="cabinet-nav" aria-label={ariaLabel}>
      {groups.map((group) => (
        <div className="cabinet-nav__group" key={group.title}>
          <span className="cabinet-nav__label">{group.title}</span>
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                className={active ? "cabinet-nav__item is-active" : "cabinet-nav__item"}
                href={item.href}
                key={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <CabinetIcon name={item.icon} />
                <span>{item.label}</span>
                {item.count ? <em>{item.count}</em> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
