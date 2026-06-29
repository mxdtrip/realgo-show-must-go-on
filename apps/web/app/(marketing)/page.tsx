import { SortingMemoryHero } from "../components/SortingMemoryHero";

const memoryTasks = [
  ["Two Sum II", "Two Pointers", "повторить", "завтра"],
  ["Longest Substring", "Sliding Window", "закрепляется", "через 3 дня"],
  ["Valid Parentheses", "Stack", "уверенно", "на неделе"],
];

const roadmapWeeks = [
  ["Неделя 1", "Arrays, Hashing, Two Pointers", "собрать базу, которая чаще всего встречается в задачах"],
  ["Неделя 2", "Sliding Window, Stack, Binary Search", "довести ключевые паттерны до уверенного воспроизведения"],
  ["Неделя 3", "Graphs, Intervals, Mock interview", "перейти от практики задач к формату интервью"],
];

const reviewCards = [
  ["Pattern", "Какой подход выбрать, если нужно найти пару чисел в отсортированном массиве?", "Two Pointers: быстрый способ сузить поиск без лишней памяти."],
  ["Mechanics", "Если сумма больше target, какой указатель нужно сдвинуть?", "Короткий вопрос возвращает в память конкретный шаг решения."],
  ["Edge case", "Что произойдёт, если подходящей пары нет?", "Карточка заранее закрепляет сценарий, на котором часто ошибаются под давлением."],
];

const pricing = [
  ["Free", "$0", "Сохраняй решённые задачи, отмечай уверенность и возвращайся к ним в правильный момент."],
  ["Pro", "$12", "Получай персональный план, расширенные карточки, тесты и экспорт в Anki для плотной подготовки."],
];

export default function Home() {
  return (
    <>
      <SortingMemoryHero />

      <section className="landing-section" id="memory">
        <div className="section-kicker">Memory</div>
        <div className="section-grid">
          <div className="section-copy">
            <h2>Решай задачи где удобно. Engram запомнит, что важно повторить.</h2>
            <p>
              После практики ты отмечаешь уровень уверенности. Engram превращает это в понятное
              расписание повторений и возвращает к темам, которые нужно закрепить перед интервью.
            </p>
          </div>
          <div className="product-demo memory-demo">
            <div className="demo-toolbar">
              <span>leetcode.com/problems/two-sum-ii</span>
              <strong>Saved</strong>
            </div>
            <div className="rating-row" aria-label="Difficulty rating">
              <button>сложно</button>
              <button>нормально</button>
              <button>уверенно</button>
            </div>
            <div className="task-table">
              {memoryTasks.map(([title, pattern, rating, next]) => (
                <div className="task-row" key={title}>
                  <strong>{title}</strong>
                  <span>{pattern}</span>
                  <em>{rating}</em>
                  <span>{next}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="roadmap">
        <div className="section-kicker">Roadmap</div>
        <div className="section-grid reverse">
          <div className="product-demo roadmap-demo">
            <div className="roadmap-head">
              <span>Backend SWE · 21 день</span>
              <strong>68% готовность</strong>
            </div>
            {roadmapWeeks.map(([week, topics, focus]) => (
              <article className="roadmap-row" key={week}>
                <span>{week}</span>
                <strong>{topics}</strong>
                <p>{focus}</p>
              </article>
            ))}
          </div>
          <div className="section-copy">
            <h2>План подготовки под твою цель и дату интервью.</h2>
            <p>
              Укажи роль, компанию и сколько времени осталось. Engram соберёт маршрут по темам,
              задачам и повторениям, чтобы каждый день подготовки имел понятный следующий шаг.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section" id="reviews">
        <div className="section-kicker">Reviews</div>
        <div className="section-copy wide">
          <h2>Повторяй паттерны так, чтобы вспомнить их на интервью.</h2>
          <p>
            Engram создаёт короткие карточки по подходу, шагам решения и граничным случаям. Вместо
            длинных конспектов ты получаешь вопросы, которые тренируют воспроизведение.
          </p>
        </div>
        <div className="review-grid">
          {reviewCards.map(([type, front, back]) => (
            <article className="review-card" key={type}>
              <span>{type}</span>
              <h3>{front}</h3>
              <p>{back}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" id="pricing">
        <div className="section-kicker">Pricing</div>
        <div className="section-grid">
          <div className="section-copy">
            <h2>Начни бесплатно. Подключи Pro, когда нужна подготовка под конкретное интервью.</h2>
            <p>
              Бесплатный план помогает собрать личную базу решённых задач. Pro добавляет маршрут
              под цель, больше повторений, тесты и экспорт в Anki.
            </p>
          </div>
          <div className="pricing-grid">
            {pricing.map(([name, price, text]) => (
              <article className="price-card" key={name}>
                <span>{name}</span>
                <strong>{price}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__brand">
            <a className="site-brand" href="/">
              Engram
            </a>
            <p>Память для подготовки к интервью. Решай, отмечай, возвращайся в нужный момент.</p>
          </div>
          <nav className="footer-col">
            <h4>product</h4>
            <a href="#memory">Memory</a>
            <a href="#roadmap">Roadmap</a>
            <a href="#reviews">Reviews</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <nav className="footer-col">
            <h4>developers</h4>
            <a href="#">Docs</a>
            <a href="#">API</a>
            <a href="#">Anki export</a>
            <a href="#">Changelog</a>
          </nav>
          <nav className="footer-col">
            <h4>company</h4>
            <a href="#">About</a>
            <a href="#">Blog</a>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </nav>
        </div>
        <div className="site-footer__bar">
          <span>© 2026 Engram. All rights reserved.</span>
          <span>built for people who interview</span>
        </div>
      </footer>
    </>
  );
}
