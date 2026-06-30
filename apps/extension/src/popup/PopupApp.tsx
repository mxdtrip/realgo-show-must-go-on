import { useState } from "react";

import type {
  DetectedSubmission,
  SubmissionPayload,
  UserDifficulty,
} from "../lib/types";
import { POPUP_CSS } from "./popup.styles";

export interface PopupAppProps {
  /**
   * undefined → still detecting (loading);
   * null      → no task detected on the page;
   * object    → show the rating form.
   */
  submission: DetectedSubmission | null | undefined;
  /** Persists the rated submission. Rejects with an Error on failure. */
  onSave: (payload: SubmissionPayload) => Promise<void>;
  /**
   * "Скрыть" on the success screen — hides the extension UI until the next
   * solved task (overlay: removes itself; toolbar popup: closes the window).
   */
  onClose?: () => void;
  /** "К повторению" on the success screen — opens the web app's review cards. */
  onReview?: () => void;
  /** Optional bug-report handler; falls back to opening a GitHub issue. */
  onReport?: () => void;
}

// Difficulty is shown easy → hard (Figma order); the value still maps 1:1 to the
// backend FSRS rating (hard | normal | easy), only the visual order/labels changed.
const DIFFICULTY_OPTIONS: { value: UserDifficulty; label: string }[] = [
  { value: "easy", label: "Легко" },
  { value: "normal", label: "Средне" },
  { value: "hard", label: "Тяжело" },
];

/** Where "Сообщить об ошибке" points when the host doesn't override it. */
const REPORT_ISSUE_URL =
  "https://github.com/mxdtrip/freeburger/issues/new?labels=extension&title=" +
  encodeURIComponent("Расширение: не распознана задача") +
  "&body=" +
  encodeURIComponent("Страница: \nЧто ожидали: \nЧто произошло: ");

type Status = "form" | "saving" | "success" | "error";

export function PopupApp({ submission, onSave, onClose, onReview, onReport }: PopupAppProps) {
  const [difficulty, setDifficulty] = useState<UserDifficulty | null>(null);
  const [status, setStatus] = useState<Status>("form");
  const [errorMsg, setErrorMsg] = useState("");

  function handleReport() {
    if (onReport) {
      onReport();
      return;
    }
    window.open(REPORT_ISSUE_URL, "_blank", "noopener,noreferrer");
  }

  if (submission === undefined) {
    return (
      <Shell>
        <div className="engram-state">
          <div className="engram-spinner" aria-label="Загрузка" />
          <span className="engram-muted">Определяем задачу…</span>
        </div>
      </Shell>
    );
  }

  if (submission === null) {
    return (
      <Shell>
        <div className="engram-state">
          <div className="engram-state__icon engram-state__icon--muted" aria-hidden="true">
            <IconExternal />
          </div>
          <p className="engram-state__text">
            Откройте задачу на NeetCode и отправьте решение — Engram подхватит её
            автоматически.
          </p>
          <button type="button" className="engram-link" onClick={handleReport}>
            Сообщить об ошибке
          </button>
        </div>
      </Shell>
    );
  }

  if (status === "success") {
    return (
      <Shell>
        <div className="engram-state">
          <div className="engram-state__icon engram-state__icon--success" aria-hidden="true">
            <IconCheck />
          </div>
          <div>
            <p className="engram-state__title engram-state__title--success">
              Успешно!
            </p>
            <p className="engram-muted" style={{ marginTop: 4 }}>
              Продолжите решать или займемся повторением?
            </p>
          </div>
          {(onClose || onReview) && (
            <div className="engram-row" style={{ width: "100%" }}>
              {onClose && (
                <button
                  className="engram-btn engram-btn--ghost"
                  style={{ flex: 1 }}
                  onClick={onClose}
                >
                  Скрыть
                </button>
              )}
              {onReview && (
                <button
                  className="engram-btn engram-btn--primary"
                  style={{ flex: 1 }}
                  onClick={onReview}
                >
                  К повторению
                </button>
              )}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  const saving = status === "saving";
  const canSave = difficulty !== null && !saving;

  async function handleSave() {
    if (difficulty === null || submission == null) return;
    setStatus("saving");
    setErrorMsg("");
    const payload: SubmissionPayload = {
      ...submission,
      userDifficulty: difficulty,
    };
    try {
      await onSave(payload);
      setStatus("success");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Не удалось сохранить.");
    }
  }

  return (
    <Shell task={submission}>
      <div className="engram-body">
        <ChoiceGroup
          label="Как далась задача?"
          options={DIFFICULTY_OPTIONS}
          value={difficulty}
          onChange={setDifficulty}
          disabled={saving}
        />

        {status === "error" ? (
          <div className="engram-error" role="alert">
            <span className="engram-error__icon" aria-hidden="true">
              <IconAlert />
            </span>
            <span className="engram-error__text">{errorMsg}</span>
            <button className="engram-error__retry" onClick={handleSave}>
              Повторить
            </button>
          </div>
        ) : (
          <button
            className="engram-btn engram-btn--primary engram-btn--block"
            disabled={!canSave}
            onClick={handleSave}
          >
            {saving ? <span className="engram-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
            {saving ? "Сохраняю…" : "Сохранить"}
          </button>
        )}
      </div>
    </Shell>
  );
}

function Shell({
  children,
  task,
}: {
  children: React.ReactNode;
  task?: DetectedSubmission;
}) {
  return (
    <div className="engram-popup">
      <style>{POPUP_CSS}</style>
      <div className="engram-header">
        <span className="engram-brand">
          <BrandMark />
          Engram
        </span>
        {task && (
          <span className="engram-chip engram-chip--accent">
            Вы справились с заданием!
          </span>
        )}
      </div>
      {task && (
        <div className="engram-task">
          <p className="engram-task__title">{task.taskTitle}</p>
          <div className="engram-task__meta">
            <span className="engram-task__platform">{task.platform}</span>
            <span className="engram-chip engram-chip--accent">submitted ✓</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

interface ChoiceGroupProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: ChoiceGroupProps<T>) {
  return (
    <div className="engram-question">
      <p className="engram-question__label">{label}</p>
      <div className="engram-choices" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="engram-choice"
            aria-pressed={value === opt.value}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Inline icons (no icon dependency; matches our inline-SVG convention) ──────
function BrandMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="engram-brand__mark"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect width="16" height="16" rx="3" fill="#2f81f7" />
      <rect x="3" y="4" width="6" height="1.5" rx="0.75" fill="#fff" />
      <rect x="3" y="7.25" width="10" height="1.5" rx="0.75" fill="#fff" />
      <rect x="3" y="10.5" width="4" height="1.5" rx="0.75" fill="#fff" />
    </svg>
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

function IconExternal() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

export { BrandMark };
