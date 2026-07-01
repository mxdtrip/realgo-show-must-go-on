"use client";

import { useEffect, useRef } from "react";

type CabinetErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function CabinetError({ error, reset }: CabinetErrorProps) {
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    console.error("Engram cabinet route error", error);
  }, [error]);

  useEffect(() => {
    retryRef.current?.focus();
  }, []);

  return (
    <main
      className="error-screen error-screen-cabinet"
      role="alert"
      aria-labelledby="cabinet-error-title"
    >
      <section className="error-screen-card">
        <div className="error-screen-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path d="M12 8v5" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.4 2.7 17.2A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.8L13.7 3.4a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <p className="error-screen-kicker">cabinet boundary</p>
        <h1 id="cabinet-error-title">Кабинет не смог открыть этот раздел</h1>
        <p className="error-screen-copy">
          Навигация и сессия остались на месте. Повторите рендер раздела, чтобы вернуться к
          работе без выхода из аккаунта.
        </p>
        {error.digest ? (
          <p className="error-screen-digest">
            <span>код ошибки</span>
            <code>{error.digest}</code>
          </p>
        ) : null}
        <div className="error-screen-actions">
          <button ref={retryRef} type="button" onClick={reset}>
            Повторить
          </button>
          <a href="/dashboard">Dashboard</a>
        </div>
      </section>
    </main>
  );
}
