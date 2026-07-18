import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "О команде",
};

const team = [
  {
    handle: "Mxdtrip",
    role: "координация и продукт",
    detail:
      "продуктовые решения и приоритеты, интеграции, деплой и секреты, часть веб-документов",
  },
  {
    handle: "MixKage",
    role: "frontend",
    detail: "веб-кабинет, страницы продукта, подключение к API",
  },
  {
    handle: "bryack",
    role: "тесты",
    detail: "автор идеи; цикл повторений и quiz-логика, автотесты и e2e-харнесс",
  },
  {
    handle: "Mikebang",
    role: "backend и devops",
    detail: "API, индексы в БД, идемпотентность операций, runbook'и и оркестрация деплоя",
  },
  {
    handle: "P1xart",
    role: "миграции данных",
    detail: "миграции схемы БД, констрейнты, консистентность данных, контракт API",
  },
  {
    handle: "PAO",
    role: "QA",
    detail: "smoke-тесты, fixtures, e2e и ручная проверка перед релизом",
  },
];

export default function AboutPage() {
  return (
    <main className="landing-section legal-page">
      <article className="pattern-profile">
        <header className="pattern-profile__hero pattern-profile__hero--center">
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
                  <span className="team-member-detail">{member.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="pattern-profile__section" id="freeburger">
          <header className="pattern-profile__rail">
            <h2>freeburger</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              ReAlgo растёт из freeburger — неформального объединения
              энтузиастов, которые делают pet-проекты не по ТЗ и не ради
              строчки в резюме, а потому что зудит довести идею до реального
              продакшена с живыми пользователями. Без дедлайнов сверху, зато
              с полной ответственностью за то, что получилось.
            </p>
            <p>
              ReAlgo — одна из таких идей, выросшая в открытый сервис.
              Исходный код —{" "}
              <a
                href="https://github.com/mxdtrip/freeburger"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/mxdtrip/freeburger
              </a>
              .
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
