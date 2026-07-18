import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "О команде",
};

const team = [
  { handle: "Дима", role: "координация и продукт" },
  { handle: "Валера", role: "frontend" },
  { handle: "Mikebang", role: "backend и devops" },
  { handle: "P1xart", role: "миграции данных" },
  { handle: "bryack", role: "тесты" },
  { handle: "PAO", role: "QA" },
];

export default function AboutPage() {
  return (
    <main className="landing-section legal-page">
      <article className="pattern-profile">
        <header className="pattern-profile__hero">
          <span className="pattern-profile__code">Команда // About</span>
          <h1>built by devs who bombed a few interviews first</h1>
          <p className="pattern-profile__lead">
            ReAlgo делает небольшая команда, которая сама проходила
            технические собеседования и знает главную проблему: решить
            задачу один раз — легко, вспомнить её через месяц на реальном
            интервью — нет. Отсюда и продукт: не ещё один список задач, а
            память подготовки.
          </p>
        </header>

        <section className="pattern-profile__section" id="team">
          <header className="pattern-profile__rail">
            <h2>Команда</h2>
          </header>
          <div className="pattern-profile__body">
            <ul className="pattern-profile__list pattern-profile__list--mechanics">
              {team.map((member) => (
                <li key={member.handle}>
                  <strong>{member.handle}</strong> — {member.role}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="pattern-profile__section" id="legal">
          <header className="pattern-profile__rail">
            <h2>Юридическая информация</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Оператором Сервиса выступает индивидуальный предприниматель
              Молчанов Дмитрий Александрович — подробности в{" "}
              <a href="/privacy">Политике конфиденциальности</a> и{" "}
              <a href="/terms">Пользовательском соглашении</a>.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="contact">
          <header className="pattern-profile__rail">
            <h2>Связаться</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Вопросы, баги, идеи — на{" "}
              <a href="mailto:mixkageyt@gmail.com">mixkageyt@gmail.com</a>{" "}
              или через <a href="/support">страницу поддержки</a>. Что нового
              в продукте — в <a href="/changelog">Changelog</a> и в{" "}
              <a href="https://t.me/realgo_devlog" target="_blank" rel="noopener noreferrer">
                Telegram-канале
              </a>
              .
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
