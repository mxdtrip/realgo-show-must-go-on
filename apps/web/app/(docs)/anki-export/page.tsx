import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Экспорт в Anki",
};

export default function AnkiExportPage() {
  return (
    <main className="landing-section legal-page">
      <article className="pattern-profile">
        <header className="pattern-profile__hero">
          <span className="pattern-profile__code">Roadmap // Anki export</span>
          <h1>Экспорт карточек в Anki</h1>
          <p className="pattern-profile__lead">
            Экспорт в Anki заявлен как часть тарифа Pro на странице{" "}
            <a href="/#pricing">Pricing</a>, но сама функция ещё в
            разработке — честно говорим об этом здесь, а не прячем за
            неработающей кнопкой.
          </p>
        </header>

        <section className="pattern-profile__section" id="status">
          <header className="pattern-profile__rail">
            <h2>Статус</h2>
          </header>
          <div className="pattern-profile__body">
            <p className="pattern-profile__pending">
              <span>в разработке</span>
              Экспорт карточек в формат Anki (.apkg) пока не реализован —
              карточки ReAlgo сейчас доступны только внутри сервиса.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="plan">
          <header className="pattern-profile__rail">
            <h2>Что планируется</h2>
          </header>
          <div className="pattern-profile__body">
            <ul className="pattern-profile__list pattern-profile__list--cues">
              <li>
                выгрузка карточек в колоду Anki (.apkg) с сохранением
                группировки по паттернам;
              </li>
              <li>
                перенос твоего текущего расписания повторений в интервалы
                Anki, а не старт с нуля;
              </li>
              <li>
                выбор, что экспортировать — всё, конкретный паттерн или
                только карточки с низкой уверенностью.
              </li>
            </ul>
          </div>
        </section>

        <section className="pattern-profile__section" id="notify">
          <header className="pattern-profile__rail">
            <h2>Сообщить, когда будет готово</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Если экспорт в Anki важен именно для твоей подготовки —
              напиши на{" "}
              <a href="mailto:mixkageyt@gmail.com">mixkageyt@gmail.com</a>{" "}
              или через <a href="/support">страницу поддержки</a>. Это
              помогает расставить приоритеты в roadmap.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
