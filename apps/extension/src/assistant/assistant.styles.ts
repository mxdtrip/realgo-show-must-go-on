export const ASSISTANT_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap");

:host, .realgo-assistant {
  --bg: #0d1117;
  --bg-2: #010409;
  --panel: #161b22;
  --border: #30363d;
  --text: #e6edf3;
  --text-dim: #7d8590;
  --text-faint: #6e7681;
  --accent: #2f81f7;
  --accent-bright: #58a6ff;
  --accent-soft: rgba(56, 139, 253, 0.15);
  --accent-line: rgba(56, 139, 253, 0.4);
  --danger: #f85149;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
}

.realgo-assistant, .realgo-assistant * { box-sizing: border-box; }

.realgo-assistant {
  width: 400px;
  background: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  pointer-events: auto;
}
.realgo-assistant--closed { width: auto; }

.realgo-agent-button {
  min-width: 150px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 1px solid var(--accent-line);
  border-radius: 999px;
  padding: 10px 14px;
  background:
    radial-gradient(180px 80px at 85% -10%, rgba(88, 166, 255, 0.24), transparent 70%),
    var(--bg);
  color: var(--text);
  box-shadow: 0 18px 44px -24px rgba(1, 4, 9, 0.95);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.realgo-agent-button:hover { border-color: var(--accent-bright); color: var(--accent-bright); }
.realgo-agent-button:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent-line); }

.realgo-agent-logo {
  width: 20px;
  height: 20px;
  object-fit: contain;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.18));
}

.realgo-agent-panel {
  width: 400px;
  height: 520px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  /* Expands out of the collapsed pill's corner (dock sits bottom-right). */
  transform-origin: bottom right;
  animation: realgo-agent-panel-in 0.22s cubic-bezier(0.2, 0.72, 0.22, 1) both;
  background:
    radial-gradient(360px 220px at 86% -10%, rgba(56, 139, 253, 0.1), transparent 68%),
    var(--bg);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 24px 70px -32px rgba(1, 4, 9, 0.95);
}

@keyframes realgo-agent-panel-in {
  from {
    opacity: 0;
    transform: translate3d(0, 10px, 0) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

/* Collapse: the component keeps the panel mounted for COLLAPSE_MS while this
   plays, then swaps to the pill button (see handleClose in AssistantApp). */
.realgo-assistant--closing .realgo-agent-panel {
  animation: realgo-agent-panel-out 0.18s cubic-bezier(0.64, 0.02, 0.4, 1) both;
  pointer-events: none;
}

@keyframes realgo-agent-panel-out {
  from {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    opacity: 0;
    transform: translate3d(0, 10px, 0) scale(0.94);
  }
}

/* The pill pops in right after the panel collapses into its corner. */
.realgo-assistant--closed .realgo-agent-button {
  transform-origin: bottom right;
  animation: realgo-agent-panel-in 0.18s cubic-bezier(0.2, 0.72, 0.22, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  .realgo-agent-panel,
  .realgo-assistant--closing .realgo-agent-panel,
  .realgo-assistant--closed .realgo-agent-button {
    animation: none;
  }
}

.realgo-agent-header {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
  background: rgba(1, 4, 9, 0.56);
}

.realgo-agent-brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
}
.realgo-agent-path {
  color: var(--text-faint);
  font-weight: 500;
}

.realgo-agent-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  padding: 4px 8px;
  border: 1px solid var(--accent-line);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-bright);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
}
.realgo-agent-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 4px rgba(56, 139, 253, 0.11);
}

.realgo-agent-iconbtn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
}
.realgo-agent-iconbtn:hover { border-color: var(--border); color: var(--text); background: rgba(255, 255, 255, 0.05); }

.realgo-agent-task {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  background: rgba(1, 4, 9, 0.26);
}
.realgo-agent-title {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.realgo-agent-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}
.realgo-agent-tag {
  max-width: 150px;
  padding: 2px 7px;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 10.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.realgo-agent-tag--easy {
  border-color: rgba(63, 185, 80, 0.4);
  color: #3fb950;
  background: rgba(63, 185, 80, 0.12);
}
.realgo-agent-tag--medium {
  border-color: rgba(210, 153, 34, 0.4);
  color: #d29922;
  background: rgba(210, 153, 34, 0.12);
}
.realgo-agent-tag--hard {
  border-color: rgba(248, 81, 73, 0.4);
  color: var(--danger);
  background: rgba(248, 81, 73, 0.12);
}
.realgo-agent-tag--leetcode {
  border-color: rgba(255, 161, 22, 0.4);
  color: #ffa116;
  background: rgba(255, 161, 22, 0.12);
}
.realgo-agent-tag--neetcode {
  border-color: rgba(56, 189, 178, 0.4);
  color: #38bdb2;
  background: rgba(56, 189, 178, 0.12);
}

.realgo-agent-messages {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding: 14px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
    transparent;
  background-size: 100% 28px;
}

.realgo-agent-msg {
  max-width: 92%;
  display: grid;
  gap: 5px;
  padding: 10px 11px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(22, 27, 34, 0.72);
  color: var(--text);
  overflow-wrap: anywhere;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}
.realgo-agent-msg--user {
  align-self: flex-end;
  border-color: var(--accent-line);
  background: var(--accent-soft);
}
.realgo-agent-msg--assistant { align-self: flex-start; }
.realgo-agent-msg__role {
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 10px;
}
.realgo-agent-msg p {
  margin: 0;
  white-space: pre-wrap;
}

.realgo-agent-loading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 11px;
}
.realgo-agent-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(125, 133, 144, 0.35);
  border-top-color: var(--accent-bright);
  border-radius: 50%;
  animation: realgo-agent-spin 0.8s linear infinite;
}
@keyframes realgo-agent-spin { to { transform: rotate(360deg); } }

.realgo-agent-error {
  margin: 0;
  color: var(--danger);
  font-size: 12px;
}

.realgo-agent-actions-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px 14px;
}

.realgo-agent-actions {
  display: flex;
  gap: 8px;
}

.realgo-agent-hints-done {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-dim);
  font-size: 11.5px;
  text-align: center;
  animation: realgo-agent-fade-in 0.35s ease;
}
@keyframes realgo-agent-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.realgo-agent-btn {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  padding: 7px 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.realgo-agent-btn:hover:not(:disabled) { border-color: var(--accent-line); color: var(--accent-bright); }
.realgo-agent-btn:disabled { cursor: not-allowed; opacity: 0.55; }

.realgo-agent-btn--hint {
  position: relative;
  flex: 1;
  overflow: hidden;
}
.realgo-agent-btn__fill {
  position: absolute;
  inset: 0;
  width: 0%;
  background: linear-gradient(90deg, var(--accent-soft), var(--accent-line));
  transition: width 0.2s linear;
}
.realgo-agent-btn__label {
  position: relative;
  z-index: 1;
}

`;
