import { CabinetPanel, StatusPill } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { extensionEvents } from "../_mock";

export default function ExtensionPage() {
  const page = getDictionary().cabinet.pages.extension;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      <div className="cabinet-grid">
        <CabinetPanel eyebrow={page.statusEyebrow} title={page.statusTitle}>
          <div className="extension-status">
            <StatusPill tone="success">{page.status}</StatusPill>
            <p>{page.statusDescription}</p>
            <button>{page.disableSync}</button>
          </div>
        </CabinetPanel>

        <CabinetPanel eyebrow={page.eventsEyebrow} title={page.eventsTitle}>
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
