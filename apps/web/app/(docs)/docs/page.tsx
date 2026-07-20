import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Документация",
};

const sections = [
  { id: "what-is", title: "Что такое ReAlgo" },
  { id: "cards", title: "Карточки и интервальные повторения" },
  { id: "patterns", title: "Паттерны и Pattern Atlas" },
  { id: "roadmap", title: "План подготовки" },
  { id: "extension", title: "Расширение" },
  { id: "plans", title: "Free и Pro" },
];

export default function DocsPage() {
  return (
    <main className="landing-section legal-page">
      <article className="pattern-profile">
        <header className="pattern-profile__hero">
          <span className="pattern-profile__code">Гайд // Docs</span>
          <h1>Как устроен ReAlgo</h1>
          <p className="pattern-profile__lead">
            Короткий гайд по основным понятиям сервиса — что именно
            запоминает ReAlgo, как устроены повторения и паттерны, и что
            получает пользователь на бесплатном и платном тарифе.
          </p>
        </header>

        <ul className="pattern-profile__subs">
          {sections.map((section, index) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>
                <span className="pattern-profile__sub-head">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span className="pattern-profile__sub-arrow" aria-hidden="true">
                    →
                  </span>
                </span>
                <span className="pattern-profile__sub-name">{section.title}</span>
              </a>
            </li>
          ))}
        </ul>

        <section className="pattern-profile__section" id="what-is">
          <header className="pattern-profile__rail">
            <h2>1. Что такое ReAlgo</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              «Solved» ещё не значит «запомнил». ReAlgo — память твоей
              подготовки к собеседованиям: браузерное расширение фиксирует
              каждую решённую задачу прямо из браузера, а интервальные
              повторения возвращают её ровно перед тем, как она забудется.
            </p>
            <p>
              Список решённых задач показывает, что уже было сделано. ReAlgo
              идёт дальше — планирует, когда к задаче вернуться, превращает
              решение в короткую карточку и подсвечивает паттерны, которые
              чаще всего забываются, как правило, ровно перед интервью.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="cards">
          <header className="pattern-profile__rail">
            <h2>2. Карточки и интервальные повторения</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Карточка не создаётся автоматически из каждой решённой задачи —
              она привязана к паттерну. Включаешь подпаттерн в личную
              практику в Pattern Atlas — и по нему становятся доступны
              карточки трёх типов (Pattern Recognition, Algorithm Mechanics,
              Edge Case) вместе со списком практических задач по этому же
              паттерну.
            </p>
            <p>
              После честной оценки уверенности («сложно» / «нормально» /
              «уверенно») ReAlgo сдвигает следующий показ карточки — легко
              решённое всплывает реже, тяжёлое — чаще. Если ответ забылся
              совсем — ничего страшного, карточка просто вернётся раньше и
              чаще, пока не закрепится.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="patterns">
          <header className="pattern-profile__rail">
            <h2>3. Паттерны и Pattern Atlas</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Pattern Atlas — карта алгоритмических паттернов и подпаттернов
              (Two Pointers, Sliding Window, Hashing и так далее). У каждого
              подпаттерна есть профиль: что это, как узнать задачу на этот
              паттерн, механика решения и типичные edge cases, плюс отдельные
              карточки практики. Тумблер «добавить в практику» на странице
              подпаттерна включает его в личный набор — от него зависят и
              доступные карточки, и список задач на /problems, и кнопка
              «начать практику» на /cards.
            </p>
            <p>
              Готовность по паттерну считается по реально решённым задачам, а
              не по факту открытия страницы — это тот же принцип честности,
              что и в карточках.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="roadmap">
          <header className="pattern-profile__rail">
            <h2>4. План подготовки</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Roadmap — маршрут по темам NeetCode 150, разбитый на недели.
              Каждая неделя — один паттерн, прогресс по ней растёт по мере
              решения задач этого паттерна. Не список из сотен
              нерассортированных задач, а один понятный шаг на день.
            </p>
            <p>
              На Pro-тарифе маршрут можно уточнить целевой ролью, компанией и
              датой интервью — тогда порядок тем и приоритет повторений
              подстраиваются под срок, который остался.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="extension">
          <header className="pattern-profile__rail">
            <h2>5. Расширение</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Профиль поддерживает четыре площадки — LeetCode,
              GeeksforGeeks, HackerRank и Codeforces. Автоматическое
              определение сдачи прямо из браузера сейчас работает для
              LeetCode и HackerRank; адаптер для GeeksforGeeks и Codeforces
              — в разработке.
            </p>
            <p>
              Расширение фиксирует минимальный учебный контекст: площадку,
              задачу, статус решения, выбранную оценку уверенности и
              паттерн, если он известен. Закрытые материалы и содержимое
              premium-страниц ему не нужны.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="plans">
          <header className="pattern-profile__rail">
            <h2>6. Free и Pro</h2>
          </header>
          <div className="pattern-profile__body">
            <ul className="pattern-profile__list pattern-profile__list--cues">
              <li>
                Free — сохранение решённых задач из браузера, оценка
                уверенности, авто-расписание повторений и базовая статистика
                прогресса;
              </li>
              <li>
                Pro — всё из Free плюс персональный план под роль и дату
                интервью, расширенные карточки с граничными случаями, тесты и
                mock-режим, приоритетные напоминания и экспорт в Anki (
                <a href="/anki-export">статус фичи</a>).
              </li>
            </ul>
            <p>
              Актуальный состав тарифов и оформление — на странице{" "}
              <a href="/#pricing">realgo.dev/#pricing</a>. Условия оплаты
              платного тарифа регулируются{" "}
              <a href="/offer">Публичной офертой</a>.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
