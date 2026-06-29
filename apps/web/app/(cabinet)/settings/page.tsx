import { CabinetPanel, StatusPill } from "../_components";

export default function SettingsPage() {
  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <span className="cabinet-eyebrow">/settings</span>
        <h1>Настройки аккаунта</h1>
        <p>Моковый экран для timezone, даты интервью, privacy controls и будущих billing-настроек.</p>
      </section>

      <div className="cabinet-grid">
        <CabinetPanel eyebrow="profile" title="Preparation settings">
          <div className="settings-list">
            <div>
              <span>email</span>
              <strong>demo@engram.dev</strong>
            </div>
            <div>
              <span>timezone</span>
              <strong>Europe/Moscow</strong>
            </div>
            <div>
              <span>interview date</span>
              <strong>2026-07-20</strong>
            </div>
            <div>
              <span>plan</span>
              <StatusPill tone="accent">Free mock</StatusPill>
            </div>
          </div>
        </CabinetPanel>

        <CabinetPanel eyebrow="privacy" title="Data controls">
          <div className="privacy-box">
            <p>
              Не вставляй NDA-материалы, premium/editorial-контент, скриншоты интервью или чужие
              закрытые материалы в заметки и AI-поля.
            </p>
            <div className="privacy-actions">
              <button>Export progress</button>
              <button>Delete account</button>
            </div>
          </div>
        </CabinetPanel>
      </div>
    </main>
  );
}
