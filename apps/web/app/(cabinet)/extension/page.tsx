import { CabinetPanel, StatusPill } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { extensionEvents } from "../_mock";

type Tone = "default" | "accent" | "success" | "warning" | "danger";

export default function ExtensionPage() {
  const page = getDictionary().cabinet.pages.extension;
  const eventMeta = new Map(page.eventTypes.map(([key, label, tone]) => [key, { label, tone }]));

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
            <div className="extension-status__head">
              <span className="live-dot" aria-hidden="true" />
              <strong>{page.platform}</strong>
              <StatusPill tone="success">{page.liveLabel}</StatusPill>
            </div>
            <p>{page.statusDescription}</p>
            <button className="btn-ghost" type="button">
              {page.disableSync}
            </button>
          </div>
        </CabinetPanel>

        <CabinetPanel eyebrow={page.eventsEyebrow} title={page.eventsTitle}>
          <div className="event-list">
            {extensionEvents.map((event) => {
              const meta = eventMeta.get(event.event);
              return (
                <article key={`${event.event}-${event.title}`}>
                  <div className="event-list__body">
                    <strong>{event.title}</strong>
                    <p>
                      {event.source} · {event.time}
                    </p>
                  </div>
                  <StatusPill tone={(meta?.tone ?? "default") as Tone}>
                    {meta?.label ?? event.event}
                  </StatusPill>
                </article>
              );
            })}
          </div>
        </CabinetPanel>
      </div>
    </main>
  );
}
