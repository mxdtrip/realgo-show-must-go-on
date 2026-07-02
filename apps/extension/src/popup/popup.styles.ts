/*
 * realgo popup styles as a string so they can be injected via a <style> tag.
 *
 * Why a string and not a .css import: the popup is reused in three hosts —
 * the toolbar popup (light DOM), the Vite preview (light DOM) and the in-page
 * fallback overlay (shadow DOM). Injecting <style> from the component keeps a
 * single source that also works inside a shadow root.
 *
 * Design tokens are scoped to `.realgo-popup` / `:host` (NOT `:root`) so the
 * custom properties cascade correctly inside a shadow root too.
 *
 * Visual system: compact terminal-grade panel using the same dark cabinet
 * palette. Keep the token set close to apps/web/app/globals.css.
 */
export const POPUP_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap");

:host, .realgo-popup {
  --bg: #0d1117;
  --bg-2: #010409;
  --panel: #161b22;
  --panel-strong: #1c2128;
  --border: #30363d;
  --border-strong: #444c56;
  --surface: rgba(22, 27, 34, 0.66);
  --line: rgba(255, 255, 255, 0.06);
  --line-strong: rgba(255, 255, 255, 0.1);
  --text: #e6edf3;
  --text-dim: #7d8590;
  --text-faint: #6e7681;
  --accent: #2f81f7;
  --accent-bright: #58a6ff;
  --accent-active: #1f6feb;
  --accent-soft: rgba(56, 139, 253, 0.15);
  --accent-line: rgba(56, 139, 253, 0.4);
  --success: #238636;
  --success-fg: #3fb950;
  --success-soft: rgba(46, 160, 67, 0.15);
  --success-line: rgba(46, 160, 67, 0.4);
  --warning: #d29922;
  --warning-bright: #e3b341;
  --warning-soft: rgba(210, 153, 34, 0.12);
  --danger: #f85149;
  --danger-fg: #f85149;
  --danger-bright: #ff7b72;
  --danger-soft: rgba(248, 81, 73, 0.1);
  --danger-line: rgba(248, 81, 73, 0.4);
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
}

.realgo-popup, .realgo-popup * { box-sizing: border-box; }

/* Panel: one fixed compact size for every popup state. */
.realgo-popup {
  width: 400px;
  height: 372px;
  display: flex;
  flex-direction: column;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background:
    radial-gradient(420px 240px at 82% -10%, rgba(56, 139, 253, 0.09), transparent 65%),
    var(--bg);
  color: var(--text);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 24px 60px -30px rgba(1, 4, 9, 0.92);
  font-family: var(--font-sans);
  font-size: 13.5px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
/* Options page is a full tab, not a fixed-size popup. */
.realgo-popup--wide {
  width: 440px;
  height: auto;
  display: block;
  background: var(--bg);
}
.realgo-popup--wide .realgo-body { padding: 20px; }

/* Header */
.realgo-header {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(1, 4, 9, 0.55);
}
.realgo-brand {
  display: inline-flex;
  align-items: baseline;
  gap: 9px;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text);
}
.realgo-brand__mark {
  display: block;
  flex-shrink: 0;
  align-self: center;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.18));
}
.realgo-path {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--text-faint);
  white-space: nowrap;
}
.realgo-header__sub {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  color: var(--text-dim);
}
.realgo-header__right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.realgo-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 100%;
  padding: 5px 10px;
  border: 1px solid var(--accent-line);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-bright);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.realgo-status::before {
  content: "";
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.realgo-status--ok {
  border-color: var(--success-line);
  background: var(--success-soft);
  color: var(--success-fg);
}
.realgo-iconbtn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}
.realgo-iconbtn:hover {
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
}
.realgo-iconbtn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent-line); }

/* Detected task block */
.realgo-task {
  display: grid;
  gap: 9px;
  padding: 16px 20px 15px;
  border-bottom: 1px solid var(--border);
  background: rgba(1, 4, 9, 0.3);
}
.realgo-eyebrow {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}
.realgo-task__title {
  margin: 0;
  color: var(--text);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}
.realgo-task__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
}
.realgo-tag,
.realgo-chip {
  display: inline-flex;
  align-items: center;
  max-width: 160px;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.realgo-chip--accent {
  color: var(--accent-bright);
  border-color: var(--accent);
  background: var(--accent-soft);
}
.realgo-chip--success {
  color: var(--success-fg);
  border-color: var(--success);
  background: var(--success-soft);
}

/* Body / question groups */
.realgo-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 14px;
  padding: 18px 20px 20px;
}
.realgo-body__center {
  display: grid;
  align-items: center;
  min-height: 0;
}
.realgo-foot { align-self: end; }
.realgo-section {
  width: 100%;
  display: grid;
  gap: 10px;
}
.realgo-section__head {
  display: flex;
  align-items: baseline;
  justify-content: center;
}
.realgo-section__title {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-faint);
}
.realgo-choices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.realgo-choice {
  min-width: 0;
  min-height: 76px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 7px;
  appearance: none;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  border-radius: 8px;
  padding: 11px 8px 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}
.realgo-choice__icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1.5px solid var(--text-faint);
  border-radius: 50%;
  color: var(--text-faint);
  transition:
    border-color 0.16s ease,
    color 0.16s ease;
}
.realgo-choice__icon svg {
  width: 15px;
  height: 15px;
  display: block;
}
.realgo-choice__label {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.realgo-choice:hover:not(:disabled):not([aria-pressed="true"]) {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
}
.realgo-choice:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--accent-line);
}
.realgo-choice[aria-pressed="true"] { color: var(--text); }
.realgo-choice[data-difficulty="easy"][aria-pressed="true"] {
  border-color: var(--success-line);
  background: var(--success-soft);
  color: var(--success-fg);
}
.realgo-choice[data-difficulty="easy"][aria-pressed="true"] .realgo-choice__icon {
  border-color: var(--success-fg);
  color: var(--success-fg);
}
.realgo-choice[data-difficulty="normal"][aria-pressed="true"] {
  border-color: rgba(210, 153, 34, 0.42);
  background: var(--warning-soft);
  color: var(--warning-bright);
}
.realgo-choice[data-difficulty="normal"][aria-pressed="true"] .realgo-choice__icon {
  border-color: var(--warning-bright);
  color: var(--warning-bright);
}
.realgo-choice[data-difficulty="hard"][aria-pressed="true"] {
  border-color: var(--danger-line);
  background: var(--danger-soft);
  color: var(--danger-bright);
}
.realgo-choice[data-difficulty="hard"][aria-pressed="true"] .realgo-choice__icon {
  border-color: var(--danger-bright);
  color: var(--danger-bright);
}
.realgo-choice:disabled { cursor: not-allowed; opacity: 0.6; }

/* Buttons */
.realgo-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 7px;
  padding: 8px 13px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease,
    opacity 0.16s ease;
}
.realgo-btn--block { width: 100%; }
.realgo-btn--lg { min-height: 38px; font-size: 12.5px; }
.realgo-btn--state { min-height: 38px; }
.realgo-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent-line); }

.realgo-btn--primary {
  background: var(--accent);
  color: #fff;
}
.realgo-btn--primary:hover:not(:disabled) {
  background: var(--accent-bright);
  transform: translateY(-1px);
}
.realgo-btn--primary:active:not(:disabled) { background: var(--accent-active); transform: none; }
.realgo-btn--primary:disabled {
  background: var(--panel-strong);
  color: var(--text-faint);
  opacity: 1;
  cursor: not-allowed;
}

.realgo-btn--ghost {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-dim);
}
.realgo-btn--ghost:hover {
  border-color: var(--line-strong);
  background: rgba(255, 255, 255, 0.07);
  color: var(--text);
}
.realgo-btn--danger {
  padding: 8px 12px;
  font-size: 11.5px;
  border: 1px solid var(--danger-line);
  background: var(--danger-soft);
  color: var(--danger-bright);
}
.realgo-btn--danger:hover { background: rgba(248, 81, 73, 0.18); }

/* ── Inputs (options) ─────────────────────────────────────────────────── */
.realgo-field { display: flex; flex-direction: column; gap: 6px; }
.realgo-field__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-dim);
}
.realgo-row { display: flex; gap: 8px; }
.realgo-row > .realgo-input { flex: 1; }
.realgo-input {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--bg-2);
  border-radius: 7px;
  color: var(--text);
  padding: 8px 11px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}
.realgo-input::placeholder { color: var(--text-faint); }
.realgo-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.realgo-divider { height: 1px; background: var(--line); border: 0; margin: 4px 0; }

/* ── Account row (options, logged in) ─────────────────────────────────── */
.realgo-account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.realgo-account__email {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text);
}
.realgo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success-fg);
  box-shadow: 0 0 0 3px var(--success-soft);
  flex-shrink: 0;
}
.realgo-account__note {
  margin: 5px 0 0 16px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

/* Centered states */
.realgo-state {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 34px 26px 28px;
  text-align: center;
}
.realgo-state__icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  line-height: 0;
}
.realgo-state__icon--muted {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-faint);
}
.realgo-state__icon--success {
  background: var(--success-soft);
  border: 1px solid var(--success);
  color: var(--success-fg);
}
.realgo-state__icon--danger {
  background: var(--danger-soft);
  border: 1px solid var(--danger-line);
  color: var(--danger-bright);
}
.realgo-state__icon svg { display: block; }
.realgo-state__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text);
}
.realgo-state__title--success { color: var(--success-fg); }
.realgo-state__error {
  max-width: 300px;
  margin: 0;
  color: var(--danger-bright);
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
}
.realgo-state__text {
  max-width: 300px;
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-dim);
}
.realgo-state__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
  margin-top: 10px;
}
.realgo-state--loading-scene { gap: 14px; padding: 40px 26px; }
.realgo-state--success-scene,
.realgo-state--error-scene {
  gap: 12px;
  padding: 30px 20px 20px;
}
.realgo-state--success-scene .realgo-state__icon,
.realgo-state--error-scene .realgo-state__icon {
  margin-top: auto;
}
.realgo-state--success-scene .realgo-state__actions,
.realgo-state--error-scene .realgo-state__actions {
  margin-top: auto;
}
.realgo-muted {
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 12px;
}

.realgo-link {
  background: none;
  border: 0;
  padding: 0;
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 11.5px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--line-strong);
  transition: color 0.16s ease;
}
.realgo-link:hover { color: var(--text-dim); }
.realgo-link--accent { color: var(--accent-bright); text-decoration-color: var(--accent-line); }
.realgo-link--accent:hover { color: var(--accent-bright); filter: brightness(1.1); }

.realgo-spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent);
  animation: realgo-spin 0.7s linear infinite;
}
@keyframes realgo-spin { to { transform: rotate(360deg); } }

/* Error banner (options page) */
.realgo-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 11px;
  border: 1px solid var(--danger-line);
  border-radius: 8px;
  background: var(--danger-soft);
}
.realgo-error__icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--danger-bright);
}
.realgo-error__text {
  flex: 1;
  color: var(--danger-bright);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.45;
}
.realgo-error__retry {
  flex-shrink: 0;
  background: none;
  border: 0;
  padding: 0;
  color: var(--accent-bright);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.45;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* In-page fallback overlay. Host positioning/isolation lives in contents/realgo.ts. */
.realgo-overlay {
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 24px 72px rgba(1, 4, 9, 0.7);
}
.realgo-overlay .realgo-popup { border-radius: 12px; }
.realgo-overlay-close {
  position: absolute;
  top: 13px;
  right: 14px;
  background: none;
  border: 0;
  color: var(--text-dim);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  z-index: 1;
}
.realgo-overlay-close:hover { color: var(--text); }

@media (prefers-reduced-motion: reduce) {
  .realgo-spinner { animation: none; }
  .realgo-choice, .realgo-btn, .realgo-iconbtn { transition: none; }
}
`;
