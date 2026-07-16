"use client";

// Секция read-only "профильных" блоков подпаттерна (что это / как узнать /
// механика / edge cases и т.д.). Семейство больше не рендерит собственную
// страницу этим компонентом — см. #166, family редиректит на /patterns.

import type { ReactNode } from "react";

export function ProfileSection({
  title,
  hint,
  empty,
  pendingNote,
  pendingBadge,
  children,
}: Readonly<{
  title: string;
  hint?: string;
  empty: boolean;
  pendingNote: string;
  pendingBadge: string;
  children: ReactNode;
}>) {
  return (
    <section className="pattern-profile__section">
      <header className="pattern-profile__rail">
        <h2>{title}</h2>
        {hint ? <p>{hint}</p> : null}
      </header>
      <div className="pattern-profile__body">
        {empty ? (
          <p className="pattern-profile__pending">
            <span>{pendingBadge}</span>
            {pendingNote}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
