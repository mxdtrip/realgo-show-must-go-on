"use client";

import { useEffect, useRef, useState } from "react";

import { MEMORY_DEMO_CSS } from "./memoryDemo.styles";

/**
 * Landing "memory" section demo — a faithful, interactive copy of the browser
 * extension popup (see apps/extension). It shows the rating form; picking a
 * difficulty flips to the "Запланировано" success screen (no action buttons),
 * which auto-reverts to the form after 5 s so the loop is self-running.
 *
 * Styling is injected via <style> from memoryDemo.styles.ts (ported from the
 * extension's POPUP_CSS) so the section always mirrors the real interface.
 */

type Difficulty = "easy" | "normal" | "hard";

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Легко" },
  { value: "normal", label: "Средне" },
  { value: "hard", label: "Тяжело" },
];

const REVERT_MS = 5000;

export function MemoryExtensionDemo() {
  const [scheduled, setScheduled] = useState(false);
  const [picked, setPicked] = useState<Difficulty | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  function handlePick(value: Difficulty) {
    setPicked(value);
    setScheduled(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    // Auto-return to the form so the demo keeps looping without interaction.
    timerRef.current = window.setTimeout(() => {
      setScheduled(false);
      setPicked(null);
    }, REVERT_MS);
  }

  return (
    <div className="realgo-popup" aria-label="Демо интерфейса расширения ReAlgo">
      <style>{MEMORY_DEMO_CSS}</style>

      <div className="realgo-header">
        <span className="realgo-brand">
          <BrandMark />
          ReAlgo
          <span className="realgo-path">~/ext</span>
        </span>
      </div>

      {scheduled ? (
        <div className="realgo-state">
          <div className="realgo-state__icon realgo-state__icon--success" aria-hidden="true">
            <IconCheck />
          </div>
          <div>
            <p className="realgo-state__title realgo-state__title--success">Запланировано</p>
            <p className="realgo-muted" style={{ marginTop: 4 }}>
              Задача добавлена в очередь повторений.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="realgo-task">
            <span className="realgo-eyebrow">Задача выполнена успешно!</span>
            <p className="realgo-task__title">Two Sum II</p>
            <div className="realgo-task__meta">
              <span className="realgo-tag">neetcode</span>
              <span className="realgo-tag">arrays</span>
              <span className="realgo-tag">two pointers</span>
              <span className="realgo-tag">sorted</span>
            </div>
          </div>

          <div className="realgo-body">
            <div className="realgo-section">
              <div className="realgo-section__head">
                <h3 className="realgo-section__title">Как далась задача?</h3>
              </div>
              <div className="realgo-choices" role="group" aria-label="Как далась задача?">
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="realgo-choice"
                    data-difficulty={opt.value}
                    aria-pressed={picked === opt.value}
                    onClick={() => handlePick(opt.value)}
                  >
                    <span className="realgo-choice__icon" aria-hidden="true">
                      <IconDifficulty kind={opt.value} />
                    </span>
                    <span className="realgo-choice__label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="realgo-hint">Выберите сложность — ReAlgo сохранит результат</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Inline icons (mirrors the extension's inline-SVG convention) ──────────────
// Brand mark = the canonical realgo logo asset (same file the site header uses).
function BrandMark() {
  return (
    <img
      className="realgo-brand__mark"
      src="/icons/realgo-mark.svg"
      width={20}
      height={20}
      alt=""
      aria-hidden="true"
    />
  );
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconDifficulty({ kind }: { kind: Difficulty }) {
  if (kind === "easy") {
    return <IconCheck />;
  }

  if (kind === "normal") {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.5 12.5c2.4-5.2 5.2-5.2 8 0s5.6 5.2 9 0" />
      </svg>
    );
  }

  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v8" />
      <path d="M12 18h.01" />
    </svg>
  );
}
