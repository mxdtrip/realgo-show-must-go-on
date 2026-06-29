"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CabinetIcon } from "./_icons";

type NavItem = Readonly<{ href: string; label: string; icon: string; count: string }>;
type NavGroup = Readonly<{ title: string; items: readonly NavItem[] }>;

export function CabinetNav({
  groups,
  ariaLabel,
}: Readonly<{ groups: readonly NavGroup[]; ariaLabel: string }>) {
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
