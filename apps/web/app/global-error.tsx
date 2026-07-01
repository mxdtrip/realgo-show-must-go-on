"use client";

import { useEffect, useRef } from "react";

import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    console.error("Engram global error", error);
  }, [error]);

  useEffect(() => {
    retryRef.current?.focus();
  }, []);

  return (
    <html lang="ru">
      <head>
        <title>Engram — ошибка сервера</title>
      </head>
      <body className="global-error-body">
        <main
          className="error-screen error-screen-global"
          role="alert"
          aria-labelledby="global-error-title"
        >
          <section className="error-screen-card">
            <div className="error-screen-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="img">
                <path d="M12 8v5" />
                <path d="M12 17h.01" />
                <path d="M10.3 3.4 2.7 17.2A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.8L13.7 3.4a2 2 0 0 0-3.4 0Z" />
              </svg>
            </div>
            <p className="error-screen-kicker">500</p>
            <h1 id="global-error-title">Engram не смог загрузить приложение</h1>
            <p className="error-screen-copy">
              Сбой произошёл выше основного layout. Повторите загрузку; если ошибка вернётся,
              используйте код для поиска в серверных логах.
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
              <a href="/">На главную</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
