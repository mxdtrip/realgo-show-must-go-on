import type { Metadata } from "next";

import { SupportForm } from "./SupportForm";

export const metadata: Metadata = {
  title: "Поддержка",
};

export default function SupportPage() {
  return (
    <main className="landing-section legal-page">
      <div className="section-copy wide">
        <div className="section-kicker">Поддержка</div>
        <h1>Есть вопрос или что-то не работает?</h1>
        <p>
          Напишите нам напрямую на{" "}
          <a href="mailto:mixkageyt@gmail.com">mixkageyt@gmail.com</a> — отвечаем с
          этого же адреса — или заполните форму ниже, она откроет письмо в вашей
          почте с уже подставленной темой.
        </p>

        <SupportForm />
      </div>
    </main>
  );
}
