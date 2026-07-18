import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Пользовательское соглашение",
};

const sections = [
  { id: "service", title: "Описание Сервиса" },
  { id: "plans", title: "Тарифы" },
  { id: "content", title: "Права на контент" },
  { id: "duties", title: "Обязанности пользователя" },
  { id: "liability", title: "Ограничение ответственности" },
  { id: "changes", title: "Изменение и прекращение действия" },
  { id: "law", title: "Применимое право" },
  { id: "disputes", title: "Разрешение споров" },
];

export default function TermsPage() {
  return (
    <main className="landing-section legal-page">
      <article className="pattern-profile">
        <header className="pattern-profile__hero">
          <span className="pattern-profile__code">Документ // Terms</span>
          <h1>Пользовательское соглашение</h1>
          <p className="pattern-profile__lead">
            Настоящее Соглашение регулирует отношения между индивидуальным
            предпринимателем Молчановым Дмитрием Александровичем (далее —
            «Правообладатель») и любым лицом, использующим сайт realgo.dev и
            одноимённое браузерное расширение (далее — «Сервис»). Регистрируя
            аккаунт или устанавливая расширение, пользователь подтверждает
            согласие с условиями настоящего Соглашения и{" "}
            <a href="/privacy">Политики конфиденциальности</a>.
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

        <section className="pattern-profile__section" id="service">
          <header className="pattern-profile__rail">
            <h2>1. Описание Сервиса</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Сервис — образовательный инструмент для подготовки к техническим
              собеседованиям: система интервальных повторений (spaced
              repetition) для алгоритмических задач, персональный план
              подготовки, AI-карточки и подсказки, а также браузерное
              расширение, фиксирующее факт решения задач на поддерживаемых
              платформах (LeetCode, NeetCode) и передающее эти данные в
              аккаунт пользователя.
            </p>
            <p>
              Сервис не аффилирован и не связан партнёрскими отношениями с
              LeetCode, HackerRank, NeetCode, GeeksforGeeks или иными
              платформами, названия которых упоминаются в интерфейсе Сервиса
              исключительно в описательных целях.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="plans">
          <header className="pattern-profile__rail">
            <h2>2. Тарифы</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Сервис предоставляется на условиях тарифа Free (бесплатно,
              ограниченная функциональность) либо Pro (платно, расширенная
              функциональность). Состав тарифов приведён на странице{" "}
              <a href="/#pricing">realgo.dev/#pricing</a>. Порядок оплаты
              платного тарифа регулируется{" "}
              <a href="/offer">Публичной офертой</a> — до момента подключения
              биллинга платный тариф недоступен для оплаты.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="content">
          <header className="pattern-profile__rail">
            <h2>3. Права на контент</h2>
          </header>
          <div className="pattern-profile__body">
            <ul className="pattern-profile__list pattern-profile__list--cues">
              <li>
                контент, создаваемый пользователем (личные заметки, оценки
                сложности, настройки), принадлежит пользователю;
              </li>
              <li>
                программный код, дизайн, тексты объяснений паттернов и
                структура AI-карточек, созданные Правообладателем, являются
                объектами его интеллектуальной собственности либо
                используются на законных основаниях;
              </li>
              <li>
                метаданные задач (название, ссылка, сложность, принадлежность
                к паттерну) получены из открытых источников и общедоступных
                материалов сторонних платформ. Правообладатель не претендует
                на авторские права на условия задач сторонних платформ;
              </li>
              <li>
                содержимое, сгенерированное с использованием функций
                искусственного интеллекта (AI-карточки, подсказки),
                формируется автоматически и может содержать неточности —
                пользователю рекомендуется самостоятельно проверять такой
                контент.
              </li>
            </ul>
          </div>
        </section>

        <section className="pattern-profile__section" id="duties">
          <header className="pattern-profile__rail">
            <h2>4. Обязанности пользователя</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Пользователь обязуется не использовать Сервис в целях,
              нарушающих законодательство РФ, не предпринимать попыток
              несанкционированного доступа к инфраструктуре Сервиса, не
              декомпилировать и не модифицировать браузерное расширение с
              целью обхода ограничений тарифа.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="liability">
          <header className="pattern-profile__rail">
            <h2>5. Ограничение ответственности</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Сервис предоставляется «как есть» (as is). Правообладатель не
              гарантирует, что использование Сервиса приведёт к успешному
              прохождению собеседований, и не несёт ответственности за
              решения, основанные на рекомендациях AI-функций.
            </p>
            <p>
              Ничто в настоящем разделе не ограничивает права потребителя,
              гарантированные Законом РФ «О защите прав потребителей» от
              07.02.1992 № 2300-1 и иным императивным законодательством РФ, —
              условия, ущемляющие такие права по сравнению с правилами,
              установленными законом, признаются недействительными в порядке
              статьи 16 указанного Закона.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="changes">
          <header className="pattern-profile__rail">
            <h2>6. Изменение и прекращение действия</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Правообладатель вправе изменять условия Соглашения, публикуя
              новую редакцию по адресу realgo.dev/terms. Правообладатель
              вправе приостановить или прекратить доступ пользователя к
              Сервису при нарушении условий настоящего Соглашения.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="law">
          <header className="pattern-profile__rail">
            <h2>7. Применимое право</h2>
          </header>
          <div className="pattern-profile__body">
            <p>К настоящему Соглашению применяется законодательство Российской Федерации.</p>
          </div>
        </section>

        <section className="pattern-profile__section" id="disputes">
          <header className="pattern-profile__rail">
            <h2>8. Разрешение споров</h2>
            <p>ст. 17 Закона о защите прав потребителей</p>
          </header>
          <div className="pattern-profile__body">
            <p>
              Споры, вытекающие из настоящего Соглашения, разрешаются путём
              переговоров с использованием контактного адреса
              Правообладателя. Пользователь-потребитель вправе по своему
              выбору обратиться в суд по месту своего жительства или
              пребывания, по месту нахождения Правообладателя либо по месту
              заключения или исполнения договора. Обязательный досудебный
              (претензионный) порядок урегулирования спора для данного вида
              услуг законом не установлен.
            </p>
          </div>
        </section>

        <p className="legal-page__date">Дата последней редакции: [указать дату публикации].</p>
      </article>
    </main>
  );
}
