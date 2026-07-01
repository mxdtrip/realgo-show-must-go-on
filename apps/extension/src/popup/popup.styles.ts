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
 * Visual system ported from the Figma Make design ("realgo Chrome Extension
 * UI"): a bordered panel with a header bar, a detected-task block and blue
 * (primary) selections — green is reserved for success only. Tokens mirror
 * apps/web/app/globals.css. TODO: move to packages/ui tokens.
 */
export const POPUP_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");

:host, .realgo-popup {
  --bg: #0d1117;
  --panel: #161b22;
  --panel-strong: #1c2128;
  --border: #30363d;
  --border-strong: #444c56;
  --text: #e6edf3;
  --text-dim: #7d8590;
  --text-faint: #6e7681;
  --accent: #2f81f7;
  --accent-strong: #388bfd;
  --accent-bright: #58a6ff;
  --accent-active: #1f6feb;
  --accent-soft: rgba(56, 139, 253, 0.12);
  --accent-line: rgba(56, 139, 253, 0.4);
  --accent-glow: rgba(56, 139, 253, 0.35);
  --success: #238636;
  --success-fg: #3fb950;
  --success-soft: rgba(35, 134, 54, 0.15);
  --danger: #da3633;
  --danger-fg: #f85149;
  --danger-soft: rgba(218, 54, 51, 0.08);
  --danger-line: rgba(218, 54, 51, 0.35);
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
}

.realgo-popup, .realgo-popup * { box-sizing: border-box; }

/* ── Panel ─────────────────────────────────────────────────────────────── */
.realgo-popup {
  width: 360px;
  /* Fixed height so the window never resizes between states (loading /
     no-task / form / success / error). The form is the tallest state; this
     value covers it (incl. the error banner). Centered states fill via flex. */
  height: 360px;
  display: flex;
  flex-direction: column;
  margin: 0;
  background: var(--panel);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 50px -30px rgba(1, 4, 9, 0.9);
}
/* Options page is a full tab, not a fixed-size popup — let it grow naturally. */
.realgo-popup--wide { width: 440px; height: auto; display: block; }

/* ── Header bar ────────────────────────────────────────────────────────── */
.realgo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-strong);
}
.realgo-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: -0.01em;
  color: var(--text);
}
.realgo-brand--md { font-size: 15px; }
.realgo-brand__mark { display: block; flex-shrink: 0; }
.realgo-header__sub {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  color: var(--accent-bright);
}

/* ── Detected task block ──────────────────────────────────────────────── */
.realgo-task {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(13, 17, 23, 0.4);
}
.realgo-task__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--text);
  text-align: center;
}
.realgo-task__meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
}
.realgo-task__platform {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
}

.realgo-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 5px;
  border: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
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

/* ── Body / question groups ───────────────────────────────────────────── */
.realgo-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
/* Anchor the form's primary action to the bottom so the fixed-height window
   reads as intentional instead of leaving a gap under the questions. */
.realgo-body > .realgo-btn--block,
.realgo-body > .realgo-error { margin-top: auto; }
.realgo-question__label {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-dim);
}
.realgo-choices {
  display: flex;
  gap: 6px;
}
.realgo-choice {
  flex: 1;
  appearance: none;
  border: none;
  background: var(--panel-strong);
  color: var(--text-dim);
  border-radius: 7px;
  padding: 8px;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.realgo-choice:hover:not(:disabled):not([aria-pressed="true"]) {
  color: var(--text);
  background: rgba(56, 139, 253, 0.12);
}
.realgo-choice:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--accent-glow);
}
.realgo-choice[aria-pressed="true"] {
  background: var(--accent);
  color: #fff;
}
.realgo-choice:disabled { color: var(--text-faint); cursor: not-allowed; }

/* ── Buttons ──────────────────────────────────────────────────────────── */
.realgo-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 8px;
  border: none;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.realgo-btn--block { width: 100%; }
.realgo-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent-glow); }

.realgo-btn--primary {
  background: var(--accent);
  color: #fff;
}
.realgo-btn--primary:hover:not(:disabled) {
  background: var(--accent-strong);
  box-shadow: 0 0 8px var(--accent-glow);
}
.realgo-btn--primary:active:not(:disabled) { background: var(--accent-active); }
.realgo-btn--primary:disabled {
  background: var(--panel-strong);
  color: var(--text-faint);
  cursor: not-allowed;
}

.realgo-btn--ghost {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  background: var(--panel-strong);
  color: var(--text-dim);
}
.realgo-btn--ghost:hover { background: var(--border); color: var(--text); }
.realgo-btn--danger {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  background: var(--danger-soft);
  color: var(--danger-fg);
}
.realgo-btn--danger:hover { background: rgba(218, 54, 51, 0.18); }

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

/* ── Centered states (loading / no-task / success) ────────────────────── */
.realgo-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 28px 16px;
  text-align: center;
}
.realgo-state__icon {
  width: 40px;
  height: 40px;
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
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}
.realgo-state__title--success { color: var(--success-fg); }
.realgo-state__text {
  max-width: 230px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-faint);
}
.realgo-muted { color: var(--text-dim); font-size: 11px; }

.realgo-link {
  background: none;
  border: 0;
  padding: 0;
  color: var(--text-faint);
  font-family: var(--font-sans);
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s ease;
}
.realgo-link:hover { color: var(--text-dim); }
.realgo-link--accent { color: var(--accent-bright); }
.realgo-link--accent:hover { color: var(--accent-bright); filter: brightness(1.1); }

.realgo-spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: var(--accent);
  animation: realgo-spin 0.7s linear infinite;
}
@keyframes realgo-spin { to { transform: rotate(360deg); } }

/* ── Error banner ─────────────────────────────────────────────────────── */
.realgo-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--danger-line);
  background: var(--danger-soft);
}
.realgo-error__icon { color: var(--danger-fg); flex-shrink: 0; margin-top: 1px; }
.realgo-error__text { flex: 1; color: var(--danger-fg); font-size: 11px; }
.realgo-error__retry {
  flex-shrink: 0;
  background: none;
  border: 0;
  padding: 0;
  color: var(--accent-bright);
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── In-page fallback overlay (shadow DOM host content) ───────────────── */
.realgo-overlay {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483647;
  border-radius: 12px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
  overflow: hidden;
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
  .realgo-choice, .realgo-btn { transition: none; }
}
`;
