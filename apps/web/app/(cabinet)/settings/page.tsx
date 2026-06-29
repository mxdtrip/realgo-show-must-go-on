import { CabinetPanel, StatusPill } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { InstallAppPanel } from "./_components/InstallAppPanel";
import { NotificationSettingsPanel } from "./_components/NotificationSettingsPanel";

export default function SettingsPage() {
  const page = getDictionary().cabinet.pages.settings;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </section>

      <div className="cabinet-grid">
        <CabinetPanel eyebrow={page.profileEyebrow} title={page.profileTitle}>
          <div className="settings-list">
            {page.settings.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
            <div>
              <span>{page.planLabel}</span>
              <StatusPill tone="accent">{page.plan}</StatusPill>
            </div>
          </div>
        </CabinetPanel>

        <CabinetPanel eyebrow={page.installEyebrow} title={page.installTitle}>
          <InstallAppPanel copy={page.install} />
        </CabinetPanel>

        <CabinetPanel eyebrow={page.notificationsEyebrow} title={page.notificationsTitle}>
          <NotificationSettingsPanel copy={page.notifications} />
        </CabinetPanel>

        <CabinetPanel eyebrow={page.privacyEyebrow} title={page.privacyTitle}>
          <div className="privacy-box">
            <p>{page.privacyDescription}</p>
            <div className="privacy-actions">
              <button>{page.exportProgress}</button>
              <button>{page.deleteAccount}</button>
            </div>
          </div>
        </CabinetPanel>
      </div>
    </main>
  );
}
