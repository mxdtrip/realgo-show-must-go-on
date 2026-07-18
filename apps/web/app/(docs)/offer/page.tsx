import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Публичная оферта",
};

const sections = [
  { id: "executor", title: "Исполнитель" },
  { id: "subject", title: "Предмет оферты" },
  { id: "price", title: "Цена и порядок оплаты" },
  { id: "withdrawal", title: "Отказ от услуги и возврат средств" },
  { id: "liability", title: "Ответственность сторон" },
  { id: "disputes", title: "Разрешение споров" },
  { id: "term", title: "Срок действия оферты" },
];

/**
 * ЧЕРНОВИК. Исполнитель зарегистрирован как ИП на НПД. Перед публикацией и
 * подключением реального биллинга осталось:
 * 1) заполнить реквизиты ниже (ОГРНИП, ИНН, адрес места нахождения — ст. 10
 *    Закона РФ «О защите прав потребителей» требует указывать адрес
 *    исполнителя, не только контактный e-mail);
 * 2) решить по валюте: цена на лендинге указана в $ — расчёты с
 *    потребителем внутри РФ должны вестись в рублях (ст. 317 ГК РФ);
 * 3) держать в уме лимит НПД — доход не должен превышать 2,4 млн ₽ в
 *    год (ст. 4 ФЗ № 422-ФЗ), иначе право на спецрежим утрачивается и
 *    нужен переход на УСН/иной режим.
 */
export default function OfferPage() {
  return (
    <main className="landing-section legal-page">
      <article className="pattern-profile">
        <header className="pattern-profile__hero">
          <span className="pattern-profile__code">Документ // Offer · черновик</span>
          <h1>Публичная оферта на оказание услуг доступа к тарифу Pro</h1>
          <p className="pattern-profile__lead">
            Настоящий документ является публичной офертой (предложением) в
            соответствии со статьёй 437 Гражданского кодекса РФ. Акцептом
            оферты является совершение конклюдентных действий: оплата тарифа
            Pro на странице realgo.dev/checkout.
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

        <section className="pattern-profile__section" id="executor">
          <header className="pattern-profile__rail">
            <h2>1. Исполнитель</h2>
          </header>
          <div className="pattern-profile__body">
            <ul className="pattern-profile__list pattern-profile__list--cues">
              <li>Индивидуальный предприниматель Молчанов Дмитрий Александрович</li>
              <li>
                Применяемый налоговый режим: налог на профессиональный доход
                (НПД) в соответствии с Федеральным законом от 27.11.2018 №
                422-ФЗ
              </li>
              <li>ОГРНИП: [заполнить]</li>
              <li>ИНН: [заполнить]</li>
              <li>Адрес места нахождения: [заполнить]</li>
              <li>
                Контакты: <a href="mailto:molchanovdma@gmail.com">molchanovdma@gmail.com</a>
              </li>
            </ul>
            <p>
              Как плательщик НПД Исполнитель не является плательщиком НДС и
              выдаёт чек об оплате через приложение «Мой налог» — чек
              направляется пользователю на указанный при оплате адрес
              электронной почты.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="subject">
          <header className="pattern-profile__rail">
            <h2>2. Предмет оферты</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Исполнитель предоставляет пользователю доступ к расширенной
              функциональности Сервиса (тариф Pro) в объёме, указанном на
              странице realgo.dev/#pricing на момент оплаты.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="price">
          <header className="pattern-profile__rail">
            <h2>3. Цена и порядок оплаты</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Актуальная стоимость тарифа Pro указана на странице оплаты в
              момент оформления и взимается в рублях РФ. Тариф предполагает
              ежемесячное автоматическое продление подписки, если пользователь
              не отменил её в настройках аккаунта до даты списания.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="withdrawal">
          <header className="pattern-profile__rail">
            <h2>4. Отказ от услуги и возврат средств</h2>
            <p>ст. 32 Закона о защите прав потребителей</p>
          </header>
          <div className="pattern-profile__body">
            <p>
              В соответствии со статьёй 32 Закона РФ «О защите прав
              потребителей» от 07.02.1992 № 2300-1, пользователь вправе
              отказаться от исполнения настоящего договора (расторгнуть
              подписку) в любой момент, направив уведомление через настройки
              аккаунта либо на контактный адрес Исполнителя. При отказе до
              истечения оплаченного периода Исполнитель возвращает
              пользователю уплаченную сумму за вычетом стоимости фактически
              предоставленного доступа к тарифу Pro за истёкшую часть периода.
            </p>
            <p>
              Отмена автопродления через настройки аккаунта прекращает
              списание за последующие периоды — доступ к уже оплаченному
              периоду сохраняется до его окончания. Любое условие настоящей
              оферты, ограничивающее права пользователя сильнее, чем
              предусмотрено законом, применению не подлежит (ст. 16 Закона РФ
              «О защите прав потребителей»).
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="liability">
          <header className="pattern-profile__rail">
            <h2>5. Ответственность сторон</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Исполнитель не несёт ответственности за результаты использования
              Сервиса пользователем. Ограничение ответственности
              осуществляется в порядке, предусмотренном{" "}
              <a href="/terms">Пользовательским соглашением</a>, и не
              распространяется на права потребителя, гарантированные
              императивными нормами законодательства РФ.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="disputes">
          <header className="pattern-profile__rail">
            <h2>6. Разрешение споров</h2>
            <p>ст. 17 Закона о защите прав потребителей</p>
          </header>
          <div className="pattern-profile__body">
            <p>
              Споры, вытекающие из настоящей оферты, разрешаются путём
              переговоров с использованием контактного адреса Исполнителя.
              Пользователь-потребитель вправе по своему выбору обратиться в
              суд по месту своего жительства или пребывания, по месту
              нахождения Исполнителя либо по месту заключения или исполнения
              настоящего договора. Обязательный досудебный (претензионный)
              порядок урегулирования спора для данного вида услуг законом не
              установлен.
            </p>
          </div>
        </section>

        <section className="pattern-profile__section" id="term">
          <header className="pattern-profile__rail">
            <h2>7. Срок действия оферты</h2>
          </header>
          <div className="pattern-profile__body">
            <p>
              Оферта действует до её отзыва Исполнителем. Действующая
              редакция всегда доступна по адресу realgo.dev/offer.
            </p>
          </div>
        </section>

        <p className="legal-page__date">Дата последней редакции: [указать дату публикации].</p>
      </article>
    </main>
  );
}
