/*
 * realgo popup styles as a string so they can be injected via a <style> tag.
 *
 * Why a string and not a .css import: the popup is reused in three hosts:
 * the toolbar popup (light DOM), the Vite preview (light DOM), and the in-page
 * fallback overlay (shadow DOM). Injecting <style> from the component keeps a
 * single source that also works inside a shadow root.
 *
 * Design tokens are scoped to `.realgo-popup` / `:host` (NOT `:root`) so the
 * custom properties cascade correctly inside a shadow root too.
 */
export const POPUP_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");

:host, .realgo-popup {
  --bg: #020812;
  --panel: rgba(4, 12, 22, 0.98);
  --panel-raised: rgba(7, 16, 29, 0.96);
  --panel-strong: rgba(10, 22, 38, 0.92);
  --border: rgba(148, 163, 184, 0.2);
  --border-strong: rgba(148, 163, 184, 0.3);
  --text: #f3f7ff;
  --text-dim: #9ba9c2;
  --text-faint: #718096;
  --accent: #2f8dff;
  --accent-strong: #58a6ff;
  --accent-soft: rgba(47, 141, 255, 0.15);
  --accent-line: rgba(47, 141, 255, 0.5);
  --accent-glow: rgba(47, 141, 255, 0.35);
  --success: #238636;
  --success-fg: #3fb950;
  --success-soft: rgba(35, 134, 54, 0.15);
  --danger: #da3633;
  --danger-fg: #f85149;
  --danger-soft: rgba(218, 54, 51, 0.08);
  --danger-line: rgba(218, 54, 51, 0.35);
  --difficulty-muted: #6f7d92;
  --difficulty-easy: #3fb950;
  --difficulty-easy-soft: rgba(63, 185, 80, 0.13);
  --difficulty-normal: #f5b84b;
  --difficulty-normal-soft: rgba(245, 184, 75, 0.13);
  --difficulty-hard: #ff5a5f;
  --difficulty-hard-soft: rgba(255, 90, 95, 0.12);
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --compact-scale: 0.5882352941;
}

.realgo-popup, .realgo-popup * { box-sizing: border-box; }

/* Panel */
.realgo-popup {
  width: 560px;
  height: 544px;
  display: flex;
  flex-direction: column;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 16px;
  background:
    radial-gradient(circle at 50% 37%, rgba(47, 141, 255, 0.22), transparent 33%),
    linear-gradient(180deg, rgba(7, 16, 29, 0.98), rgba(3, 10, 18, 0.99));
  color: var(--text);
  box-shadow:
    0 24px 72px rgba(0, 0, 0, 0.55),
    0 0 80px rgba(47, 141, 255, 0.08);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.realgo-popup--compact {
  zoom: var(--compact-scale);
}

/* Options page is a full tab, not a fixed-size popup. */
.realgo-popup--wide {
  width: 440px;
  height: auto;
  display: block;
  background: var(--panel);
}
.realgo-popup--wide .realgo-header { min-height: 62px; padding: 14px 18px; }
.realgo-popup--wide .realgo-brand { gap: 10px; font-size: 16px; }
.realgo-popup--wide .realgo-body { padding: 20px; overflow: visible; }

/* Header bar */
.realgo-header {
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 28px;
  border-bottom: 1px solid var(--border);
  background: rgba(3, 10, 18, 0.58);
}
.realgo-brand {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--text);
}
.realgo-brand--md { font-size: 21px; }
.realgo-brand__mark {
  display: block;
  flex-shrink: 0;
  filter: drop-shadow(0 8px 18px rgba(47, 141, 255, 0.35));
}
.realgo-header__sub {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-strong);
}
.realgo-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.realgo-status {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  min-height: 36px;
  padding: 8px 13px;
  border: 1px solid var(--accent-line);
  border-radius: 9px;
  background: rgba(8, 20, 36, 0.68);
  color: var(--accent-strong);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
}
.realgo-status__icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 2px solid currentColor;
  border-radius: 50%;
}
.realgo-iconbtn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.realgo-iconbtn:hover {
  border-color: var(--border);
  background: rgba(148, 163, 184, 0.08);
  color: var(--text);
}
.realgo-iconbtn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent-glow); }

/* Detected task block */
.realgo-task {
  min-height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 32px 32px 30px;
  border-bottom: 1px solid var(--border);
  background:
    radial-gradient(circle at 50% 50%, rgba(47, 141, 255, 0.22), transparent 46%),
    rgba(4, 12, 22, 0.36);
  text-align: center;
}
.realgo-task__title {
  margin: 0;
  max-width: 460px;
  color: var(--text);
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0;
}
.realgo-task__meta {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
}
.realgo-tag {
  display: inline-flex;
  align-items: center;
  max-width: 160px;
  min-height: 30px;
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(10, 22, 38, 0.58);
  color: var(--text-dim);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Body / question groups */
.realgo-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  justify-content: center;
  padding: 0 24px;
  overflow: hidden;
}
.realgo-foot {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 24px 24px;
  background: rgba(3, 10, 18, 0.24);
}

/* Section */
.realgo-section {
  width: 100%;
  padding: 0;
}
.realgo-section__head {
  min-height: 64px;
  display: grid;
  place-items: center;
  margin-bottom: 0;
  text-align: center;
}
.realgo-section__title {
  margin: 0;
  transform: translateY(-10px);
  color: var(--text);
  font-family: var(--font-display);
  font-size: 21.6px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: 0;
}
.realgo-choices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(4, 12, 22, 0.62);
}
.realgo-choice {
  min-width: 0;
  min-height: 100px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  appearance: none;
  border: 0;
  border-right: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  padding: 18px 10px 17px;
  font-family: var(--font-sans);
  font-size: 21.6px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.realgo-choice:last-child { border-right: 0; }
.realgo-choice__icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1.5px solid var(--difficulty-muted);
  border-radius: 50%;
  color: var(--difficulty-muted);
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}
.realgo-choice__label {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.realgo-choice:hover:not(:disabled):not([aria-pressed="true"]) {
  background: rgba(47, 141, 255, 0.08);
}
.realgo-choice:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px rgba(88, 166, 255, 0.35);
}
.realgo-choice[aria-pressed="true"] {
  color: var(--text);
}
.realgo-choice[data-difficulty="easy"][aria-pressed="true"] {
  background: var(--difficulty-easy-soft);
}
.realgo-choice[data-difficulty="easy"][aria-pressed="true"] .realgo-choice__icon {
  background: var(--difficulty-easy-soft);
  border-color: var(--difficulty-easy);
  color: var(--difficulty-easy);
}
.realgo-choice[data-difficulty="normal"][aria-pressed="true"] {
  background: var(--difficulty-normal-soft);
}
.realgo-choice[data-difficulty="normal"][aria-pressed="true"] .realgo-choice__icon {
  background: var(--difficulty-normal-soft);
  border-color: var(--difficulty-normal);
  color: var(--difficulty-normal);
}
.realgo-choice[data-difficulty="hard"][aria-pressed="true"] {
  background: var(--difficulty-hard-soft);
}
.realgo-choice[data-difficulty="hard"][aria-pressed="true"] .realgo-choice__icon {
  background: var(--difficulty-hard-soft);
  border-color: var(--difficulty-hard);
  color: var(--difficulty-hard);
}
.realgo-choice:disabled { cursor: not-allowed; opacity: 0.62; }

/* Buttons */
.realgo-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 10px 16px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease,
    opacity 0.15s ease;
}
.realgo-btn--block { width: 100%; }
.realgo-btn--lg {
  min-height: 48px;
  padding: 13px 16px;
  border-radius: 8px;
  font-size: 21.6px;
}
.realgo-btn--state {
  min-width: 128px;
  min-height: 42px;
  padding: 11px 16px;
  border-radius: 8px;
  font-size: 14px;
}
.realgo-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent-glow); }
.realgo-btn--primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}
.realgo-btn--primary:hover:not(:disabled) {
  border-color: var(--accent-strong);
  background: var(--accent-strong);
  box-shadow: 0 0 16px rgba(47, 141, 255, 0.25);
}
.realgo-btn--primary:active:not(:disabled) { background: #1f6feb; }
.realgo-btn--primary:disabled {
  border-color: var(--border);
  background: rgba(10, 22, 38, 0.42);
  color: var(--text-faint);
  opacity: 1;
  cursor: not-allowed;
}
.realgo-btn--ghost {
  border-color: var(--border);
  background: rgba(10, 22, 38, 0.48);
  color: var(--text-dim);
}
.realgo-btn--ghost:hover {
  border-color: var(--border-strong);
  background: rgba(148, 163, 184, 0.12);
  color: var(--text);
}
.realgo-btn--danger {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  background: var(--danger-soft);
  color: var(--danger-fg);
}
.realgo-btn--danger:hover { background: rgba(218, 54, 51, 0.18); }

/* Inputs (options) */
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
  background: var(--bg);
  border-radius: 7px;
  color: var(--text);
  padding: 8px 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.realgo-input::placeholder { color: var(--text-faint); }
.realgo-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.realgo-divider { height: 1px; background: var(--border); border: 0; margin: 0; }

/* Account row (options, logged in) */
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
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}
.realgo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success-fg);
  flex-shrink: 0;
}
.realgo-account__note {
  margin: 4px 0 0 16px;
  font-size: 11px;
  color: var(--text-faint);
}

/* Centered states (loading / no-task / success) */
.realgo-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 28px;
  text-align: center;
}
.realgo-state__icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
}
.realgo-state__icon--muted {
  background: var(--panel-strong);
  border: 1px solid var(--border);
  color: var(--text-faint);
}
.realgo-state__icon--success {
  background: var(--success-soft);
  border: 1px solid var(--success);
  color: var(--success-fg);
}
.realgo-state__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.realgo-state__title--success { color: var(--success-fg); }
.realgo-state__text {
  max-width: 310px;
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-faint);
}
.realgo-state__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  width: 100%;
  margin-top: 6px;
}
.realgo-state--loading-scene {
  gap: 20px;
  padding: 34px 40px 42px;
}
.realgo-state--loading-scene .realgo-spinner {
  width: 58px;
  height: 58px;
  border-width: 5px;
}
.realgo-state--loading-scene .realgo-muted {
  font-size: 20px;
  line-height: 1.45;
}
.realgo-state--no-task-scene .realgo-state__text,
.realgo-state--no-task-scene .realgo-link {
  font-size: 20px;
  line-height: 1.45;
}
.realgo-state--success-scene {
  --success-action-gap: 24px;
  justify-content: flex-start;
  gap: 20px;
  padding: 34px var(--success-action-gap) var(--success-action-gap);
}
.realgo-state--success-scene > div:not(.realgo-state__actions) {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.realgo-state--success-scene .realgo-state__icon {
  width: 58px;
  height: 58px;
  /* Absorb the free space above the icon; the actions get the same auto margin
     below, so the icon + text block sits centered and the buttons stay pinned
     to the bottom of the card. */
  margin-top: auto;
}
.realgo-state--success-scene .realgo-state__icon svg {
  width: 24px;
  height: 24px;
  /* Inline SVG is aligned on the text baseline, so inside the grid cell it
     floats above the true center. display:block drops the baseline gap; the
     tiny nudge compensates the check glyph's own ~0.5px high ink center. */
  display: block;
  transform: translateY(0.5px);
}
.realgo-state--success-scene .realgo-state__title {
  font-size: 21.6px;
  line-height: 1.15;
}
.realgo-state--success-scene .realgo-muted {
  margin-top: 8px !important;
  font-size: 16px;
  line-height: 1.45;
}
.realgo-state--success-scene .realgo-state__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--success-action-gap);
  margin-top: auto;
}
.realgo-state--success-scene .realgo-btn--state {
  width: 100%;
  min-width: 0;
  min-height: 54px;
  padding: 14px 20px;
  font-size: 21.6px;
}
.realgo-muted { color: var(--text-dim); font-size: 12px; }

.realgo-link {
  background: none;
  border: 0;
  padding: 0;
  color: var(--text-faint);
  font-family: var(--font-sans);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s ease;
}
.realgo-link:hover { color: var(--text-dim); }
.realgo-link--accent { color: var(--accent-strong); }
.realgo-link--accent:hover { color: var(--accent-strong); filter: brightness(1.1); }

.realgo-spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: var(--accent);
  animation: realgo-spin 0.7s linear infinite;
}
@keyframes realgo-spin { to { transform: rotate(360deg); } }

/* Error banner */
.realgo-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--danger-line);
  border-radius: 8px;
  background: var(--danger-soft);
}
.realgo-error__icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--danger-fg);
}
.realgo-error__text {
  flex: 1;
  color: var(--danger-fg);
  font-size: 18px;
  line-height: 1.25;
}
.realgo-error__retry {
  flex-shrink: 0;
  background: none;
  border: 0;
  padding: 0;
  color: var(--accent-strong);
  font-size: 18px;
  line-height: 1.25;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* In-page fallback overlay (shadow DOM host content) */
.realgo-overlay {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483647;
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.55);
}
.realgo-overlay .realgo-popup { border-radius: 16px; }

@media (prefers-reduced-motion: reduce) {
  .realgo-spinner { animation: none; }
  .realgo-choice, .realgo-btn, .realgo-iconbtn { transition: none; }
}
`;
