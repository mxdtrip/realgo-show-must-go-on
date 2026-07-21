import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Страница не найдена" };

export default function NotFound() {
  return (
    <main className="error-screen error-screen-not-found" aria-labelledby="not-found-title">
      <section className="error-screen-card">
        <div className="error-screen-icon error-screen-icon-muted" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path d="M9 9h.01" />
            <path d="M15 9h.01" />
            <path d="M8 16c1.1-1 2.4-1.5 4-1.5s2.9.5 4 1.5" />
            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <p className="error-screen-kicker">404</p>
        <h1 id="not-found-title">Такого экрана нет</h1>
        <p className="error-screen-copy">
          Ссылка могла устареть или маршрут ещё не добавлен в ReAlgo. Вернитесь в кабинет или на
          главную страницу.
        </p>
        <div className="error-screen-actions">
          <Link className="error-screen-primary" href="/dashboard">
            В кабинет
          </Link>
          <Link className="error-screen-secondary" href="/">
            На главную
          </Link>
        </div>
      </section>
    </main>
  );
}
