"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CabinetInterviewCountdown } from "../(cabinet)/CabinetInterviewCountdown";
import { CabinetNav, type CabinetNavGroup } from "../(cabinet)/CabinetNav";

type InterviewCopy = {
  missing: string;
  past: string;
  prefix: string;
  today: string;
};

type CabinetMobileNavProps = {
  ariaLabel: string;
  brand: string;
  defaultInterviewDate: string;
  defaultTimezone: string;
  groups: readonly CabinetNavGroup[];
  interviewCopy: InterviewCopy;
};

const DESKTOP_NAV_QUERY = "(min-width: 921px)";
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (node) => node.getClientRects().length > 0 && node.getAttribute("aria-hidden") !== "true",
  );
}

export function CabinetMobileNav({
  ariaLabel,
  brand,
  defaultInterviewDate,
  defaultTimezone,
  groups,
  interviewCopy,
}: Readonly<CabinetMobileNavProps>) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  const closeAfterNavigation = useCallback(() => {
    window.setTimeout(closeMenu, 0);
  }, [closeMenu]);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_NAV_QUERY);
    const closeOnDesktop = () => {
      if (media.matches) setOpen(false);
    };

    closeOnDesktop();
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = focusableElements(panel);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const activeElement = document.activeElement;
      const first = items[0];
      const last = items[items.length - 1];

      if (!panel.contains(activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, closeMenu]);

  return (
    <div className="cabinet-mobile-nav">
      <button
        ref={triggerRef}
        className="cabinet-mobile-nav__trigger"
        type="button"
        aria-label={open ? "Закрыть навигацию" : "Открыть навигацию"}
        aria-expanded={open}
        aria-controls="cabinet-mobile-nav-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open ? (
        <div
          className="cabinet-mobile-nav__overlay"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeMenu();
          }}
        >
          <div
            ref={panelRef}
            id="cabinet-mobile-nav-panel"
            className="cabinet-mobile-nav__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cabinet-mobile-nav-title"
            tabIndex={-1}
          >
            <div className="cabinet-mobile-nav__head">
              <div className="cabinet-brand-block">
                <Link className="site-brand" href="/" onClick={closeAfterNavigation}>
                  {brand}
                </Link>
                <CabinetInterviewCountdown
                  copy={interviewCopy}
                  defaultInterviewDate={defaultInterviewDate}
                  defaultTimezone={defaultTimezone}
                />
              </div>
              <button
                ref={closeButtonRef}
                className="cabinet-mobile-nav__close"
                type="button"
                onClick={closeMenu}
                aria-label="Закрыть навигацию"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <h2 className="cabinet-mobile-nav__title" id="cabinet-mobile-nav-title">
              Навигация
            </h2>
            <CabinetNav groups={groups} ariaLabel={ariaLabel} onNavigate={closeAfterNavigation} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
