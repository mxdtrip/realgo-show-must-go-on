"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type HotkeysCopy = Readonly<{
  title: string;
  description: string;
  disableLabel: string;
  disabledNote: string;
  close: string;
  groups: ReadonlyArray<
    Readonly<{ title: string; items: ReadonlyArray<ReadonlyArray<string>> }>
  >;
}>;

const STORAGE_KEY = "realgo.cabinet.hotkeys";
const SEQUENCE_TIMEOUT_MS = 1600;

// event.code вместо event.key: работает одинаково на en/ru раскладках.
const GO_TARGETS: Record<string, string> = {
  KeyD: "/dashboard",
  KeyR: "/reviews",
  KeyP: "/problems",
  KeyC: "/cards",
  KeyT: "/patterns",
  KeyS: "/settings",
};

const SESSION_ROUTE = "/cards/session";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest("input, textarea, select, [contenteditable]") !== null;
}

export function CabinetHotkeys({ copy }: Readonly<{ copy: HotkeysCopy }>) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const helpOpenRef = useRef(helpOpen);
  const disabledRef = useRef(disabled);
  const pendingGoUntil = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  helpOpenRef.current = helpOpen;
  disabledRef.current = disabled;

  useEffect(() => {
    setDisabled(window.localStorage.getItem(STORAGE_KEY) === "off");
  }, []);

  useEffect(() => {
    if (helpOpen) dialogRef.current?.focus();
  }, [helpOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === "Escape") {
        if (helpOpenRef.current) {
          event.preventDefault();
          setHelpOpen(false);
        }
        return;
      }

      // Пока открыт чужой оверлей (репорт, тур) — все хоткеи молчат.
      const overlayOpen = document.querySelector("[data-shell-overlay]") !== null;
      const otherOverlayOpen = overlayOpen && !helpOpenRef.current;

      if (event.key === "?") {
        if (otherOverlayOpen) return;
        event.preventDefault();
        setHelpOpen((value) => !value);
        return;
      }

      if (overlayOpen || disabledRef.current) return;

      const now = Date.now();
      if (event.code === "KeyG") {
        pendingGoUntil.current = now + SEQUENCE_TIMEOUT_MS;
        return;
      }

      const goTarget = GO_TARGETS[event.code];
      if (pendingGoUntil.current > now && goTarget) {
        pendingGoUntil.current = 0;
        event.preventDefault();
        router.push(goTarget);
        return;
      }
      pendingGoUntil.current = 0;

      if (event.code === "KeyS") {
        event.preventDefault();
        router.push(SESSION_ROUTE);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  function toggleDisabled(next: boolean) {
    setDisabled(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "off" : "on");
  }

  if (!helpOpen) return null;

  return (
    <div
      className="shell-overlay"
      data-shell-overlay
      role="presentation"
      onClick={() => setHelpOpen(false)}
    >
      <div
        className="shell-dialog shell-dialog--hotkeys"
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shell-dialog__head">
          <strong>{copy.title}</strong>
          <button
            className="shell-dialog__close"
            type="button"
            aria-label={copy.close}
            onClick={() => setHelpOpen(false)}
          >
            ×
          </button>
        </header>
        <p className="shell-dialog__note">{copy.description}</p>
        {copy.groups.map((group) => (
          <div className="hotkeys-group" key={group.title}>
            <span className="hotkeys-group__label">{group.title}</span>
            <dl className="hotkeys-list">
              {group.items.map(([keys, action]) => (
                <div key={keys}>
                  <dt>
                    {keys.split(" ").map((key, index) => (
                      <kbd key={`${key}-${index}`}>{key}</kbd>
                    ))}
                  </dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <label className="hotkeys-toggle">
          <input
            type="checkbox"
            checked={disabled}
            onChange={(event) => toggleDisabled(event.target.checked)}
          />
          <span>{copy.disableLabel}</span>
        </label>
        {disabled ? (
          <p className="shell-dialog__note shell-dialog__note--warn">{copy.disabledNote}</p>
        ) : null}
      </div>
    </div>
  );
}
