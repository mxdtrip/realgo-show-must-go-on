"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "../_api/AuthProvider";

type AccountCopy = {
  name: string;
  email: string;
  initials: string;
  rows: ReadonlyArray<readonly [string, string]>;
  menuSettings: string;
  menuLogout: string;
  logoutPending: string;
};

export function CabinetUserMenu({ copy }: { copy: AccountCopy }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    await logout();
    router.push("/");
  }

  return (
    <div className="user-panel" ref={rootRef}>
      {open ? (
        <div className="user-menu" role="menu">
          <div className="user-menu__head">
            <span className="user-avatar" aria-hidden="true">
              {copy.initials}
            </span>
            <div className="user-menu__head-id">
              <strong>{copy.name}</strong>
              <span>{copy.email}</span>
            </div>
          </div>
          <dl className="user-menu__rows">
            {copy.rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="user-menu__actions">
            <Link href="/settings" role="menuitem" onClick={() => setOpen(false)}>
              {copy.menuSettings}
            </Link>
            <button
              className="user-menu__logout"
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={pending}
            >
              {pending ? copy.logoutPending : copy.menuLogout}
            </button>
          </div>
        </div>
      ) : null}

      <button
        className="user-chip"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="user-avatar" aria-hidden="true">
          {copy.initials}
          <i className="user-avatar__dot" />
        </span>
        <span className="user-chip__id">
          <strong>{copy.name}</strong>
          <span>{copy.email}</span>
        </span>
        <span className="user-chip__caret" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 7.5 6 4l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
    </div>
  );
}
