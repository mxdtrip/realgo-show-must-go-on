"use client";

import { useCallback, useEffect, useState } from "react";

export type TourCopy = Readonly<{
  badge: string;
  stepOf: string;
  next: string;
  done: string;
  skip: string;
  steps: ReadonlyArray<Readonly<{ target: string; title: string; text: string }>>;
}>;

const STORAGE_KEY = "realgo.cabinet.tour";

// Перезапуск тура для тестов и ручной проверки: хоткей `g w` (см.
// CabinetHotkeys) шлёт это событие, а `?tour=1` в URL форсит показ,
// игнорируя done-флаг в localStorage.
export const TOUR_RESTART_EVENT = "realgo:cabinet:tour-restart";

const SPOTLIGHT_PAD = 6;
const CARD_WIDTH = 320;
const CARD_GAP = 16;

type TargetRect = Readonly<{ top: number; left: number; width: number; height: number }>;

function measureTarget(target: string): TargetRect | null {
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  const rect = el?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function cardPosition(rect: TargetRect): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Справа от цели; не влезает — под целью; всегда прижимаем в границы окна.
  let left = rect.left + rect.width + CARD_GAP;
  let top = rect.top;
  if (left + CARD_WIDTH > vw - 12) {
    left = Math.min(Math.max(rect.left, 12), Math.max(vw - CARD_WIDTH - 12, 12));
    top = rect.top + rect.height + CARD_GAP;
  }
  top = Math.min(Math.max(top, 12), Math.max(vh - 230, 12));
  return { top, left, width: Math.min(CARD_WIDTH, vw - 24) };
}

export function CabinetWelcomeTour({ copy }: Readonly<{ copy: TourCopy }>) {
  const [step, setStep] = useState(-1); // -1 = закрыт
  const [rect, setRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get("tour") === "1";
    if (!forced && window.localStorage.getItem(STORAGE_KEY) === "done") return;
    // Даём кабинету дорисоваться, чтобы замеры якорей были честными.
    const id = window.setTimeout(() => setStep(0), 600);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    function onRestart() {
      setStep(0);
    }
    document.addEventListener(TOUR_RESTART_EVENT, onRestart);
    return () => document.removeEventListener(TOUR_RESTART_EVENT, onRestart);
  }, []);

  const active = step >= 0 && step < copy.steps.length ? copy.steps[step] : null;

  useEffect(() => {
    if (!active) return;
    function measure() {
      setRect(measureTarget(active!.target));
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active]);

  const finish = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "done");
    setStep(-1);
  }, []);

  useEffect(() => {
    if (!active) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, finish]);

  if (!active) return null;

  const isLast = step + 1 >= copy.steps.length;

  return (
    <div
      className={rect ? "shell-overlay shell-overlay--tour" : "shell-overlay shell-overlay--tour is-dim"}
      data-shell-overlay
      role="presentation"
    >
      {rect ? (
        <div
          className="tour-spotlight"
          style={{
            top: rect.top - SPOTLIGHT_PAD,
            left: rect.left - SPOTLIGHT_PAD,
            width: rect.width + SPOTLIGHT_PAD * 2,
            height: rect.height + SPOTLIGHT_PAD * 2,
          }}
        />
      ) : null}
      <div
        className={rect ? "tour-card" : "tour-card tour-card--centered"}
        style={rect ? cardPosition(rect) : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={active.title}
      >
        <span className="tour-card__badge">
          {copy.badge} · {step + 1} {copy.stepOf} {copy.steps.length}
        </span>
        <strong>{active.title}</strong>
        <p>{active.text}</p>
        <div className="tour-card__actions">
          <button
            className="shell-btn shell-btn--primary"
            type="button"
            onClick={() => (isLast ? finish() : setStep(step + 1))}
          >
            {isLast ? copy.done : copy.next}
          </button>
          {!isLast ? (
            <button className="shell-btn shell-btn--ghost" type="button" onClick={finish}>
              {copy.skip}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
