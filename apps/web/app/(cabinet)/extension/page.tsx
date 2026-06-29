import { CabinetPanel, StatusPill } from "../_components";
import { extensionEvents } from "../_mock";

export default function ExtensionPage() {
  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">/extension</span>
        <h1>Расширение и синхронизация</h1>
        <p>Показываем только безопасный слой событий: slug, URL, title, rating и timestamp. HTML страниц не храним.</p>
      </section>

      <div className="cabinet-grid">
        <CabinetPanel eyebrow="status" title="Connection">
          <div className="extension-status">
            <StatusPill tone="success">connected mock</StatusPill>
            <p>Авто-синхронизация включена для LeetCode. Подключение пока визуальное, без обращения к backend.</p>
            <button>Disable auto-sync</button>
          </div>
        </CabinetPanel>

        <CabinetPanel eyebrow="events" title="Last events">
          <div className="event-list">
            {extensionEvents.map((event) => (
              <article key={`${event.event}-${event.title}`}>
                <span>{event.source}</span>
                <strong>{event.title}</strong>
                <p>
                  {event.event} · {event.time}
                </p>
              </article>
            ))}
          </div>
        </CabinetPanel>
      </div>
    </main>
  );
}
