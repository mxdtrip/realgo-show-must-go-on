import { CabinetPanel } from "../_components";
import { getDictionary } from "../../_content/i18n";
import { accountSecurityCopy } from "../../_content/i18n";
import { InstallAppPanel } from "./_components/InstallAppPanel";
import { NotificationSettingsPanel } from "./_components/NotificationSettingsPanel";
import { PrivacyActions } from "./_components/PrivacyActions";
import { ProfileSettingsPanel } from "./_components/ProfileSettingsPanel";
import { SecurityPanel } from "./_components/SecurityPanel";

export default function SettingsPage() {
  const page = getDictionary().cabinet.pages.settings;

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
        <CabinetPanel eyebrow={page.profileEyebrow} title={page.profileTitle}>
          <ProfileSettingsPanel copy={page.profile} />
        </CabinetPanel>

        <CabinetPanel
          eyebrow={accountSecurityCopy.panelEyebrow}
          title={accountSecurityCopy.panelTitle}
        >
          <SecurityPanel />
        </CabinetPanel>

        {/* PWA + privacy share one grid cell: both are short, and pairing the
            short install panel with the tall notifications one left a large
            hole under it (grid rows are as tall as their tallest panel). */}
        <div className="cabinet-grid__stack">
          <CabinetPanel eyebrow={page.installEyebrow} title={page.installTitle}>
            <InstallAppPanel copy={page.install} />
          </CabinetPanel>

          <CabinetPanel eyebrow={page.privacyEyebrow} title={page.privacyTitle} padded>
            <PrivacyActions copy={page} />
          </CabinetPanel>
        </div>

        <CabinetPanel eyebrow={page.notificationsEyebrow} title={page.notificationsTitle}>
          <NotificationSettingsPanel copy={page.notifications} />
        </CabinetPanel>
      </div>
    </main>
  );
}
