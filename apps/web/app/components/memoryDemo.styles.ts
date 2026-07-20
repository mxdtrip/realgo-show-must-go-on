/*
 * Styles for the landing "memory" section extension-popup demo.
 *
 * Ported verbatim from apps/extension/src/popup/popup.styles.ts (POPUP_CSS) so
 * the landing shows the *actual* extension interface. Injected via a <style>
 * tag inside the component; tokens are scoped to `.realgo-popup` (no `:root`),
 * so nothing leaks into the rest of the page and vice versa.
 *
 * The only intentional difference from the extension file: the Google Fonts
 * @import is dropped — the web app already loads Inter / Space Grotesk /
 * JetBrains Mono, and the font-family stacks below fall back cleanly.
 * Keep in sync with the extension by hand when the popup design changes.
 */
export const MEMORY_DEMO_CSS = `
:host, .realgo-popup {
  /* surfaces — GitHub Primer dark */
  --bg: #0d1117;
  --bg-2: #010409;
  --panel: #161b22;
  --panel-strong: #1c2128;
  --border: #30363d;
  --border-strong: #444c56;
  --surface: rgba(22, 27, 34, 0.66);
  --line: rgba(255, 255, 255, 0.06);
  --line-strong: rgba(255, 255, 255, 0.1);

  /* text */
  --text: #e6edf3;
  --text-dim: #7d8590;
  --text-faint: #6e7681;

  /* accent — GitHub blue */
  --accent: #2f81f7;
  --accent-bright: #58a6ff;
  --accent-soft: rgba(56, 139, 253, 0.15);
  --accent-line: rgba(56, 139, 253, 0.4);

  /* semantic tones (Primer scale); green = success only */
  --success: #238636;
  --success-fg: #3fb950;
  --success-soft: rgba(46, 160, 67, 0.15);
  --success-line: rgba(46, 160, 67, 0.4);
  --warning: #d29922;
  --warning-bright: #e3b341;
  --warning-soft: rgba(210, 153, 34, 0.12);
  --danger: #f85149;
  --danger-bright: #ff7b72;
  --danger-soft: rgba(248, 81, 73, 0.1);
  --danger-line: rgba(248, 81, 73, 0.4);

  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
}

.realgo-popup, .realgo-popup * { box-sizing: border-box; }

/* Panel: fixed height and desktop max-width for every state. */
.realgo-popup {
  width: 100%;
  max-width: 400px;
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

/* Header bar: brand + terminal path */
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

/* Detected task block */
.realgo-task {
  display: grid;
  justify-items: center;
  gap: 9px;
  padding: 16px 20px 15px;
  border-bottom: 1px solid var(--border);
  background: rgba(1, 4, 9, 0.3);
  text-align: center;
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
  font-size: 17px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}
.realgo-task__meta {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
}
.realgo-tag {
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

/* Body / question groups. Pinned toward the bottom so the difficulty block
   sits lower in the card. */
.realgo-body {
  flex: 1;
  min-height: 0;
  display: grid;
  align-content: end;
  gap: 16px;
  padding: 18px 20px 22px;
}

/* Save hint */
.realgo-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 18px;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11.5px;
  line-height: 1.3;
  color: var(--text-faint);
  text-align: center;
}

/* Section */
.realgo-section {
  width: 100%;
  display: grid;
  gap: 20px;
}
.realgo-section__head { display: flex; align-items: baseline; justify-content: center; }
.realgo-section__title {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: normal;
  color: var(--text);
}

/* difficulty: segmented mono control */
.realgo-choices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
.realgo-choice {
  min-width: 0;
  min-height: 84px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  appearance: none;
  border: 0;
  border-right: 1px solid var(--line);
  background: transparent;
  color: var(--text-dim);
  padding: 13px 8px 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition:
    background 0.16s ease,
    color 0.16s ease;
}
.realgo-choice:last-child { border-right: 0; }
.realgo-choice__icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1.5px solid var(--text-faint);
  border-radius: 50%;
  color: var(--text-faint);
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}
.realgo-choice__icon svg { width: 15px; height: 15px; display: block; }
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
  background: var(--success-soft);
  color: var(--success-fg);
}
.realgo-choice[data-difficulty="easy"][aria-pressed="true"] .realgo-choice__icon {
  border-color: var(--success-fg);
  color: var(--success-fg);
}
.realgo-choice[data-difficulty="normal"][aria-pressed="true"] {
  background: var(--warning-soft);
  color: var(--warning-bright);
}
.realgo-choice[data-difficulty="normal"][aria-pressed="true"] .realgo-choice__icon {
  border-color: var(--warning-bright);
  color: var(--warning-bright);
}
.realgo-choice[data-difficulty="hard"][aria-pressed="true"] {
  background: var(--danger-soft);
  color: var(--danger-bright);
}
.realgo-choice[data-difficulty="hard"][aria-pressed="true"] .realgo-choice__icon {
  border-color: var(--danger-bright);
  color: var(--danger-bright);
}
.realgo-choice:disabled { cursor: not-allowed; opacity: 0.6; }

/* Centered states (success) fill the fixed panel */
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
.realgo-state__icon--success {
  background: var(--success-soft);
  border: 1px solid var(--success);
  color: var(--success-fg);
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
.realgo-muted {
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 12px;
}

/* Smooth transition between form <-> "Запланировано". Each state subtree
   fades + rises on mount, so swapping screens reads as a soft cross-fade
   inside the fixed-size card. */
@keyframes realgo-demo-in {
  from {
    opacity: 0;
    transform: translateY(7px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.realgo-state {
  animation: realgo-demo-in 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.realgo-task {
  animation: realgo-demo-in 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.realgo-body {
  animation: realgo-demo-in 0.34s cubic-bezier(0.2, 0.8, 0.2, 1) 0.04s both;
}

@media (prefers-reduced-motion: reduce) {
  .realgo-choice { transition: none; }
  .realgo-state,
  .realgo-task,
  .realgo-body {
    animation: none;
  }
}
`;
