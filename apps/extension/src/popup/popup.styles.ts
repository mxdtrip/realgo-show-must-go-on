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
 * Tokens replicate apps/web/app/globals.css. TODO: move to packages/ui tokens.
 */
export const POPUP_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&family=JetBrains+Mono:wght@400;500;700&display=swap");

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
  --accent-bright: #58a6ff;
  --accent-soft: rgba(56, 139, 253, 0.15);
  --accent-line: rgba(56, 139, 253, 0.4);
  --success: #238636;
  --success-bright: #2ea043;
  --success-fg: #3fb950;
  --warning: #d29922;
  --danger: #ff7b72;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
}

.engram-popup, .engram-popup * { box-sizing: border-box; }

.engram-popup {
  width: 340px;
  margin: 0;
  padding: 18px 18px 20px;
  background: radial-gradient(120% 80% at 50% -20%, #161d2b 0%, #0f141c 50%, var(--bg) 80%);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.engram-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.02em;
  color: var(--text);
}
.engram-brand::before {
  content: "";
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--accent);
  box-shadow: 0 0 14px var(--accent-bright);
}

.engram-saved-label {
  margin-top: 16px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--success-fg);
}
.engram-task-title {
  margin: 6px 0 0;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text);
}
.engram-task-meta {
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
  word-break: break-all;
}

.engram-question { margin-top: 18px; }
.engram-question__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-dim);
}
.engram-choices {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 8px;
}
.engram-choice {
  appearance: none;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-dim);
  border-radius: 9px;
  padding: 9px 6px;
  font-family: var(--font-sans);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.engram-choice:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--border-strong);
  color: var(--text);
}
.engram-choice:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.engram-choice[aria-pressed="true"] { color: var(--text); }
.engram-choice--hard[aria-pressed="true"],
.engram-choice--no[aria-pressed="true"] {
  border-color: rgba(255, 123, 114, 0.6);
  background: rgba(255, 123, 114, 0.14);
  color: #ffb3ad;
}
.engram-choice--normal[aria-pressed="true"],
.engram-choice--probably[aria-pressed="true"] {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: var(--accent-bright);
}
.engram-choice--easy[aria-pressed="true"],
.engram-choice--yes[aria-pressed="true"] {
  border-color: rgba(63, 185, 80, 0.6);
  background: rgba(46, 160, 67, 0.16);
  color: var(--success-fg);
}

.engram-save {
  width: 100%;
  margin-top: 20px;
  border: 0;
  border-radius: 10px;
  padding: 12px 16px;
  background: var(--success);
  color: #fff;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, opacity 0.18s ease;
}
.engram-save:hover:not(:disabled) { background: var(--success-bright); }
.engram-save:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent-soft); }
.engram-save:disabled { opacity: 0.45; cursor: not-allowed; }

.engram-error {
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 123, 114, 0.4);
  background: rgba(255, 123, 114, 0.1);
  border-radius: 9px;
  color: #ffb3ad;
  font-size: 12.5px;
}
.engram-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 120px;
  text-align: center;
}
.engram-success-mark {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(46, 160, 67, 0.16);
  border: 1px solid rgba(63, 185, 80, 0.5);
  color: var(--success-fg);
  font-size: 22px;
}
.engram-success-title { font-family: var(--font-display); font-size: 16px; font-weight: 600; }
.engram-muted { color: var(--text-dim); font-size: 12.5px; }
.engram-spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  animation: engram-spin 0.7s linear infinite;
}
@keyframes engram-spin { to { transform: rotate(360deg); } }
.engram-link-btn {
  margin-top: 6px;
  background: none;
  border: 0;
  color: var(--accent-bright);
  font-size: 12.5px;
  cursor: pointer;
}
.engram-link-btn:hover { text-decoration: underline; }

/* In-page fallback overlay wrapper (shadow DOM host content) */
.engram-overlay {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483647;
  border-radius: 14px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.06);
  overflow: hidden;
}
.engram-overlay .engram-popup { border-radius: 14px; }
.engram-overlay-close {
  position: absolute;
  top: 10px;
  right: 12px;
  background: none;
  border: 0;
  color: var(--text-dim);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  z-index: 1;
}
.engram-overlay-close:hover { color: var(--text); }
`;
