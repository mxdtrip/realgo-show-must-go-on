"use client";

import { useEffect, useState } from "react";

const AUTH_BYPASS = process.env.NEXT_PUBLIC_AUTH_BYPASS === "1";
const DEMO_BANNER_STORAGE_KEY = "realgo.demo-banner.dismissed";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!AUTH_BYPASS) return;

    try {
      setDismissed(window.sessionStorage.getItem(DEMO_BANNER_STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!AUTH_BYPASS || dismissed) {
    return null;
  }

  function dismiss() {
    try {
      window.sessionStorage.setItem(DEMO_BANNER_STORAGE_KEY, "1");
    } catch {
      // Ignore private-mode storage failures; the in-memory close still works.
    }
    setDismissed(true);
  }

  return (
    <section className="demo-banner" aria-label="Демо-режим">
      <span className="demo-banner__badge">demo</span>
      <div className="demo-banner__copy">
        <strong>Демо-режим включен</strong>
        <span>Авторизация отключена для просмотра кабинета на моковых данных.</span>
      </div>
      <button className="demo-banner__close" type="button" onClick={dismiss} aria-label="Скрыть демо-баннер">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </section>
  );
}
