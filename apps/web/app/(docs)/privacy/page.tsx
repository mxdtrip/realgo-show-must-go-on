import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
};

const sections = [
  { id: "operator", title: "Оператор персональных данных" },
  { id: "data", title: "Какие данные обрабатываются" },
  { id: "purposes", title: "Цели обработки" },
  { id: "basis", title: "Правовые основания обработки" },
  { id: "transfer", title: "Передача третьим лицам и трансграничная передача" },
  { id: "cookies", title: "Файлы cookie и локальное хранение" },
  { id: "retention", title: "Сроки хранения" },
  { id: "rights", title: "Права пользователя" },
  { id: "minors", title: "Обработка данных несовершеннолетних" },
  { id: "changes", title: "Изменение Политики" },
];

export default function PrivacyPage() {
  return (
    <main className="landing-section legal-page">
      <article className="pattern-profile">
        <header className="pattern-profile__hero">
          <span className="pattern-profile__code">Документ // Privacy</span>
          <h1>Политика конфиденциальности</h1>
          <p className="pattern-profile__lead">
            Настоящая Политика определяет порядок обработки персональных данных
            пользователей сайта realgo.dev и одноимённого браузерного расширения
            (далее вместе — «Сервис»).
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

        <section className="pattern-profile__section" id="operator">
          <header className="pattern-profile__rail">
            <h2>1. Оператор персональных данных</h2>
            <p>ст. 18.1 ФЗ № 152-ФЗ</p>
          </header>
          <div className="pattern-profile__body">
            <p>
              Обработку персональных данных осуществляет индивидуальный
              предприниматель Молчанов Дмитрий Александрович (далее —
              «Оператор»).
            </p>
            <ul className="pattern-profile__list pattern-profile__list--cues">
              <li>ОГРНИП: [заполнить]</li>
              <li>ИНН: [заполнить]</li>
              <li>Адрес: [заполнить]</li>
              <li>
                Контакты по вопросам обработки персональных данных:{" "}
                <a href="mailto:molchanovdma@gmail.com">molchanovdma@gmail.com</a>
              </li>
            </ul>
            <p>
              Используя Сервис, пользователь подтверждает, что ознакомился с
              условиями настоящей Политики и предоставляет согласие на
              обработку своих персональных данных на изложенных ниже условиях.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="data">
          <header className="pattern-profile__rail">
            <h2>2. Какие данные обрабатываются</h2>
          </header>
          <div className="pattern-profile__body">
            <ul className="pattern-profile__list pattern-profile__list--cues">
              <li>
                адрес электронной почты и хэш пароля — для создания и
                аутентификации аккаунта;
              </li>
              <li>
                часовой пояс, дата предполагаемого собеседования, целевая
                позиция и компания, уровень (grade), цель подготовки — для
                персонализации плана подготовки;
              </li>
              <li>настройки уведомлений (дайджест, напоминания о повторении);</li>
              <li>
                данные об активности в Сервисе: какие задачи просмотрены,
                отправлены на проверку или решены, оценки сложности (hard /
                normal / easy), история и расписание повторений;
              </li>
              <li>
                технические события браузерного расширения: факт решения
                задачи на LeetCode или NeetCode, название, ссылка, сложность и
                теги задачи, версия расширения, время события;
              </li>
              <li>
                обезличенные технические метаданные обращений к функциям на
                основе искусственного интеллекта: используемая модель, число
                токенов, статус запроса.
              </li>
            </ul>
            <p>
              Сервис не запрашивает специальные категории персональных данных
              (о здоровье, религии, политических взглядах и т. п.) и не имеет
              доступа к содержимому редактора кода на LeetCode или NeetCode —
              расширение не считывает код решения пользователя.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="purposes">
          <header className="pattern-profile__rail">
            <h2>3. Цели обработки</h2>
          </header>
          <div className="pattern-profile__body">
            <ul className="pattern-profile__list pattern-profile__list--cues">
              <li>регистрация, идентификация и аутентификация пользователя;</li>
              <li>
                предоставление функциональности Сервиса: система интервальных
                повторений, персональный план подготовки, генерация
                AI-карточек и подсказок;
              </li>
              <li>
                направление уведомлений и напоминаний, если пользователь их не
                отключил;
              </li>
              <li>улучшение качества Сервиса и устранение неполадок.</li>
            </ul>
          </div>
        </section>

        <section className="pattern-profile__section" id="basis">
          <header className="pattern-profile__rail">
            <h2>4. Правовые основания обработки</h2>
            <p>ст. 9 ФЗ № 152-ФЗ</p>
          </header>
          <div className="pattern-profile__body">
            <p>
              Обработка осуществляется на основании согласия пользователя (ст.
              9 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных
              данных»), предоставляемого при регистрации, а также в объёме,
              необходимом для исполнения договора между пользователем и
              Оператором в части платных функций — с момента публикации
              Публичной оферты.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="transfer">
          <header className="pattern-profile__rail">
            <h2>5. Передача третьим лицам и трансграничная передача</h2>
            <p>ст. 12 ФЗ № 152-ФЗ</p>
          </header>
          <div className="pattern-profile__body">
            <p>
              Для функций на основе искусственного интеллекта (генерация
              AI-карточек и подсказок) Сервис использует внешние API:
            </p>
            <ul className="pattern-profile__list pattern-profile__list--cues">
              <li>Google Gemini API (Google LLC, США);</li>
              <li>Groq API (Groq, Inc., США).</li>
            </ul>
            <p>
              Этим сервисам передаётся содержимое задачи и контекста,
              необходимое для генерации ответа. Оператор не передаёт им адрес
              электронной почты, пароль или иные прямые идентификаторы
              личности пользователя сверх технически необходимого для
              обработки запроса.
            </p>
            <p>
              США не входит в перечень государств, обеспечивающих адекватную
              защиту прав субъектов персональных данных, который ведёт
              Роскомнадзор. Трансграничная передача осуществляется на
              основании согласия пользователя, предоставляемого при
              использовании соответствующих функций, в объёме, минимально
              необходимом для оказания услуги.
            </p>
            <p>
              Основная база данных Сервиса физически размещена на серверном
              оборудовании, расположенном на территории Российской Федерации.
              Сервис не продаёт персональные данные пользователей и не
              передаёт их в целях, не связанных с оказанием услуг Сервиса.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="cookies">
          <header className="pattern-profile__rail">
            <h2>6. Файлы cookie и локальное хранение</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Сервис использует технически необходимые cookie и localStorage
              для хранения токена авторизации и настроек интерфейса.
              Браузерное расширение хранит токен доступа и данные последней
              отправленной задачи в chrome.storage.local — эти данные не
              покидают устройство иначе как в виде запросов к API realgo.dev.
              На момент публикации настоящей Политики Сервис не использует
              сторонние аналитические или рекламные cookie.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="retention">
          <header className="pattern-profile__rail">
            <h2>7. Сроки хранения</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Персональные данные хранятся в течение всего срока действия
              аккаунта и удаляются либо обезличиваются в разумный срок после
              запроса на удаление, направленного на контактный адрес
              Оператора, либо через функцию самостоятельного удаления
              аккаунта в настройках Сервиса.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="rights">
          <header className="pattern-profile__rail">
            <h2>8. Права пользователя</h2>
            <p>ст. 14–15 ФЗ № 152-ФЗ</p>
          </header>
          <div className="pattern-profile__body">
            <ul className="pattern-profile__list pattern-profile__list--cues">
              <li>запросить информацию об обрабатываемых персональных данных;</li>
              <li>
                потребовать уточнения, блокирования или уничтожения данных,
                если они неполны, устарели или обрабатываются с нарушением
                закона;
              </li>
              <li>
                отозвать согласие на обработку персональных данных, направив
                обращение на контактный адрес Оператора;
              </li>
              <li>отключить уведомления и рассылки в настройках аккаунта;</li>
              <li>
                самостоятельно выгрузить свои данные или удалить аккаунт в
                разделе настроек Сервиса.
              </li>
            </ul>
            <p>
              Отзыв согласия может повлечь невозможность дальнейшего
              использования отдельных функций Сервиса.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="minors">
          <header className="pattern-profile__rail">
            <h2>9. Обработка данных несовершеннолетних</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Сервис не предназначен для лиц младше 14 лет. Лица от 14 до 18
              лет используют Сервис самостоятельно в пределах дееспособности,
              предусмотренной статьёй 26 Гражданского кодекса РФ.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="changes">
          <header className="pattern-profile__rail">
            <h2>10. Изменение Политики</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Оператор вправе вносить изменения в настоящую Политику.
              Актуальная редакция всегда доступна по адресу realgo.dev/privacy.
              О существенных изменениях пользователи уведомляются через
              интерфейс Сервиса или по электронной почте.
            </p>
          </div>
        </section>

        <p className="legal-page__date">Дата последней редакции: [указать дату публикации].</p>
      </article>
    </main>
  );
}
