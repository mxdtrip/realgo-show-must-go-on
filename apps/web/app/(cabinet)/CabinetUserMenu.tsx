"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "../_api/AuthProvider";
import { openReportProblemDialog } from "./ReportProblemDialog";

type AccountCopy = {
  name: string;
  email: string;
  initials: string;
  rows: ReadonlyArray<readonly [string, string]>;
  menuSettings: string;
  menuReport: string;
  menuLogout: string;
  logoutPending: string;
};

export function CabinetUserMenu({ copy }: { copy: AccountCopy }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const router = useRouter();

  // The avatar chip must reflect the authenticated account, not the demo
  // fixtures shipped in the i18n dictionary. Fall back to copy only while the
  // session is still loading or in demo mode. The chip shows plan (free/pro)
  // next to the name instead of the email; the email is no longer surfaced.
  const displayName = user ? user.email.split("@")[0] : copy.name;
  const displayPlan = user?.plan ?? "free";
  const initials = user ? user.email.slice(0, 2).toLowerCase() : copy.initials;
  const rows: ReadonlyArray<readonly [string, string]> = copy.rows
    .filter((row) => row[0] !== "plan")
    .map((row) => {
      const [label, fallback] = row;
      if (label === "interview" && user?.interview_date) {
        const date = new Date(user.interview_date);
        const value =
          date && !Number.isNaN(date.getTime())
            ? date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
            : fallback;
        return [label, value] as const;
      }
      return row;
    });

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
              {initials}
            </span>
            <div className="user-menu__head-id">
              <strong>{displayName}</strong>
              <span>{displayPlan}</span>
            </div>
          </div>
          <dl className="user-menu__rows">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="user-menu__actions">
            <button
              className="user-menu__report"
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                openReportProblemDialog();
              }}
            >
              {copy.menuReport}
            </button>
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
              {initials}
              <i className="user-avatar__dot" />
            </span>
            <span className="user-chip__id">
              <strong>{displayName}</strong>
              <span>{displayPlan}</span>
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
