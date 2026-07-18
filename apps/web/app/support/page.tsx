import type { Metadata } from "next";

import { SupportForm } from "./SupportForm";

export const metadata: Metadata = {
  title: "Поддержка",
};

export default function SupportPage() {
  return (
    <main className="landing-section legal-page">
      <article className="pattern-profile">
        <header className="pattern-profile__hero">
          <span className="pattern-profile__code">Документ // Support</span>
          <h1>Есть вопрос или что-то не работает?</h1>
          <p className="pattern-profile__lead">
            Напишите нам напрямую на{" "}
            <a href="mailto:mixkageyt@gmail.com">mixkageyt@gmail.com</a> — отвечаем
            с этого же адреса — или заполните форму ниже, она откроет письмо в
            вашей почте с уже подставленной темой.
          </p>
        </header>

        <section className="pattern-profile__section">
          <header className="pattern-profile__rail">
            <h2>Форма обращения</h2>
          </header>
          <div className="pattern-profile__body">
            <SupportForm />
          </div>
        </section>
      </article>
    </main>
  );
}
