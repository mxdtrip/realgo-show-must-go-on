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
        <div>
          <span className="cabinet-eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
      </section>

      <div className="cabinet-grid">
        <CabinetPanel
          eyebrow={page.statusEyebrow}
          title={page.statusTitle}
          meta={<span className="cabinet-panel__meta">{page.statusMeta}</span>}
        >
          <div className="extension-status">
            {page.platforms.map((platform) => (
              <div className="ext-platform" key={platform.name}>
                <span
                  className={platform.live ? "live-dot" : "live-dot live-dot--idle"}
                  aria-hidden="true"
                />
                <strong>{platform.name}</strong>
                <StatusPill tone={platform.tone as Tone}>{platform.state}</StatusPill>
              </div>
            ))}
            <div className="extension-meta">
              {page.meta.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="extension-status__note">{page.statusDescription}</p>
            <div className="extension-status__actions">
              <button className="btn-ghost" type="button">
                {page.disableSync}
              </button>
            </div>
          </div>
        </CabinetPanel>

        <CabinetPanel
          eyebrow={page.eventsEyebrow}
          title={page.eventsTitle}
          meta={<span className="cabinet-panel__meta">{page.eventsMeta}</span>}
        >
          <div className="term-log">
            {extensionEvents.map((event) => {
              const meta = eventMeta.get(event.event);
              return (
                <div className="term-log__row" key={`${event.at}-${event.title}`}>
                  <span className="term-log__time">{event.at}</span>
                  <span className="term-log__source">{event.source}</span>
                  <span className="term-log__title">{event.title}</span>
                  <span className={`term-log__event term-log__event--${meta?.tone ?? "default"}`}>
                    {meta?.label ?? event.event}
                  </span>
                </div>
              );
            })}
            <div className="term-log__listen">
              <i aria-hidden="true" />
              {page.listening}
            </div>
          </div>
        </CabinetPanel>
      </div>
    </main>
  );
}
