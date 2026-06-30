/*
 * Engram popup styles as a string so they can be injected via a <style> tag.
 *
 * Why a string and not a .css import: the popup is reused in three hosts —
 * the toolbar popup (light DOM), the Vite preview (light DOM) and the in-page
 * fallback overlay (shadow DOM). Injecting <style> from the component keeps a
 * single source that also works inside a shadow root.
 *
 * Design tokens are scoped to `.engram-popup` / `:host` (NOT `:root`) so the
 * custom properties cascade correctly inside a shadow root too.
 *
 * Visual system ported from the Figma Make design ("Engram Chrome Extension
 * UI"): a bordered panel with a header bar, a detected-task block and blue
 * (primary) selections — green is reserved for success only. Tokens mirror
 * apps/web/app/globals.css. TODO: move to packages/ui tokens.
 */
export const POPUP_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");

:host, .engram-popup {
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

.engram-popup, .engram-popup * { box-sizing: border-box; }

/* ── Panel ─────────────────────────────────────────────────────────────── */
.engram-popup {
  width: 360px;
  /* Fixed height so the window never resizes between states (loading /
     no-task / form / success / error). Sized to the tallest state — the form
     with the two-line error banner (~388px). Shorter states keep the CTA
     pinned to the bottom (.engram-foot margin-top:auto); centered states fill
     via flex. */
  height: 392px;
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
.engram-popup--wide { width: 440px; height: auto; display: block; }

/* ── Header bar ────────────────────────────────────────────────────────── */
.engram-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-strong);
}
.engram-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: -0.01em;
  color: var(--text);
}
.engram-brand--md { font-size: 15px; }
.engram-brand__mark { display: block; flex-shrink: 0; }
.engram-header__sub {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  color: var(--accent-bright);
}
.engram-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
}
/* Borderless "submitted" status that lives on the top bar next to the brand. */
.engram-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-bright);
}
.engram-iconbtn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: var(--panel-strong);
  color: var(--text-dim);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.engram-iconbtn:hover { background: var(--border); color: var(--text); }
.engram-iconbtn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent-glow); }

/* ── Detected task block ──────────────────────────────────────────────── */
.engram-task {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(13, 17, 23, 0.4);
}
.engram-task__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--text);
}
.engram-task__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.engram-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 6px;
  background: var(--panel-strong);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-dim);
}

/* ── Body / question groups ───────────────────────────────────────────── */
.engram-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 16px 16px;
}
/* The footer (hint/error + CTA) is pinned to the bottom so the fixed-height
   window reads as intentional rather than leaving a gap under the questions. */
.engram-foot {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Section (titled question group) ──────────────────────────────────── */
.engram-section__head { margin-bottom: 10px; }
.engram-section__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}
.engram-section__sub {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--text-dim);
}

/* ── Hint line ────────────────────────────────────────────────────────── */
.engram-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-faint);
}
.engram-hint__icon { display: inline-flex; flex-shrink: 0; color: var(--text-faint); }

.engram-choices {
  display: flex;
  gap: 8px;
}
.engram-choice {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  appearance: none;
  border: 1.5px solid transparent;
  background: var(--panel-strong);
  color: var(--text);
  border-radius: 10px;
  padding: 13px 10px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.engram-choice__label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.engram-choice:hover:not(:disabled):not([aria-pressed="true"]) {
  background: #232a33;
  border-color: var(--border-strong);
}
.engram-choice:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--accent-glow);
}
.engram-choice[aria-pressed="true"] {
  background: rgba(47, 129, 247, 0.16);
  border-color: var(--accent);
  color: var(--text);
  box-shadow: 0 0 0 1px var(--accent), 0 0 12px -2px var(--accent-glow);
}
/* Blue circular check badge on the selected option. */
.engram-choice__check {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
}
.engram-choice:disabled { cursor: not-allowed; opacity: 0.6; }

/* ── Buttons ──────────────────────────────────────────────────────────── */
.engram-btn {
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
.engram-btn--block { width: 100%; }
.engram-btn--lg { padding: 13px 16px; font-size: 14px; border-radius: 10px; }
.engram-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent-glow); }

.engram-btn--primary {
  background: var(--accent);
  color: #fff;
}
.engram-btn--primary:hover:not(:disabled) {
  background: var(--accent-strong);
  box-shadow: 0 0 10px var(--accent-glow);
}
.engram-btn--primary:active:not(:disabled) { background: var(--accent-active); }
/* Stay visibly "primary" when disabled (just dimmed) instead of going gray —
   the CTA should never read as a dead control. */
.engram-btn--primary:disabled {
  background: var(--accent);
  color: #fff;
  opacity: 0.45;
  cursor: not-allowed;
}

.engram-btn--ghost {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  background: var(--panel-strong);
  color: var(--text-dim);
}
.engram-btn--ghost:hover { background: var(--border); color: var(--text); }
.engram-btn--danger {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  background: var(--danger-soft);
  color: var(--danger-fg);
}
.engram-btn--danger:hover { background: rgba(218, 54, 51, 0.18); }

/* ── Inputs (options) ─────────────────────────────────────────────────── */
.engram-field { display: flex; flex-direction: column; gap: 6px; }
.engram-field__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-dim);
}
.engram-row { display: flex; gap: 8px; }
.engram-row > .engram-input { flex: 1; }
.engram-input {
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
.engram-input::placeholder { color: var(--text-faint); }
.engram-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.engram-divider { height: 1px; background: var(--border); border: 0; margin: 0; }

/* ── Account row (options, logged in) ─────────────────────────────────── */
.engram-account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.engram-account__email {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}
.engram-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success-fg);
  flex-shrink: 0;
}
.engram-account__note {
  margin: 4px 0 0 16px;
  font-size: 11px;
  color: var(--text-faint);
}

/* ── Centered states (loading / no-task / success) ────────────────────── */
.engram-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 28px 16px;
  text-align: center;
}
.engram-state__icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
}
.engram-state__icon--muted {
  background: var(--panel-strong);
  border: 1px solid var(--border);
  color: var(--text-faint);
}
.engram-state__icon--success {
  background: var(--success-soft);
  border: 1px solid var(--success);
  color: var(--success-fg);
}
.engram-state__title {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}
.engram-state__title--success { color: var(--success-fg); }
.engram-state__text {
  max-width: 230px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-faint);
}
.engram-muted { color: var(--text-dim); font-size: 11px; }

.engram-link {
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
.engram-link:hover { color: var(--text-dim); }
.engram-link--accent { color: var(--accent-bright); }
.engram-link--accent:hover { color: var(--accent-bright); filter: brightness(1.1); }

.engram-spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: var(--accent);
  animation: engram-spin 0.7s linear infinite;
}
@keyframes engram-spin { to { transform: rotate(360deg); } }

/* ── Error banner ─────────────────────────────────────────────────────── */
.engram-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--danger-line);
  background: var(--danger-soft);
}
.engram-error__icon { color: var(--danger-fg); flex-shrink: 0; margin-top: 1px; }
.engram-error__text { flex: 1; color: var(--danger-fg); font-size: 11px; }
.engram-error__retry {
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
.engram-overlay {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483647;
  border-radius: 12px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}
.engram-overlay .engram-popup { border-radius: 12px; }

@media (prefers-reduced-motion: reduce) {
  .engram-spinner { animation: none; }
  .engram-choice, .engram-btn { transition: none; }
}
`;
