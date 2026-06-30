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
  /** Optional close handler (extension popup can't always close itself). */
  onClose?: () => void;
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

export function PopupApp({ submission, onSave, onClose, onReport }: PopupAppProps) {
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
      <Shell onClose={onClose}>
        <div className="engram-state">
          <div className="engram-spinner" aria-label="Загрузка" />
          <span className="engram-muted">Определяем задачу…</span>
        </div>
      </Shell>
    );
  }

  if (submission === null) {
    return (
      <Shell onClose={onClose}>
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
      <Shell onClose={onClose}>
        <div className="engram-state">
          <div className="engram-state__icon engram-state__icon--success" aria-hidden="true">
            <IconCheck />
          </div>
          <div>
            <p className="engram-state__title engram-state__title--success">
              Запланировано
            </p>
            <p className="engram-muted" style={{ marginTop: 4 }}>
              Задача добавлена в очередь повторений.
            </p>
          </div>
          {onClose && (
            <button className="engram-link" onClick={onClose}>
              Закрыть
            </button>
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
    <Shell task={submission} onClose={onClose}>
      <div className="engram-body">
        <ChoiceGroup
          title="Оцени сложность"
          subtitle="Насколько тяжело далось решение?"
          options={DIFFICULTY_OPTIONS}
          value={difficulty}
          onChange={setDifficulty}
          disabled={saving}
        />

        <div className="engram-foot">
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
            <p className="engram-hint">
              <span className="engram-hint__icon" aria-hidden="true">
                <IconInfo />
              </span>
              Следующее повторение будет рассчитано после сохранения
            </p>
          )}

          <button
            className="engram-btn engram-btn--primary engram-btn--block engram-btn--lg"
            disabled={!canSave}
            onClick={handleSave}
          >
            {saving ? (
              <span
                className="engram-spinner"
                style={{ width: 15, height: 15, borderWidth: 2 }}
              />
            ) : null}
            {saving ? "Сохраняю…" : "Сохранить"}
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  task,
  onClose,
}: {
  children: React.ReactNode;
  task?: DetectedSubmission;
  onClose?: () => void;
}) {
  return (
    <div className="engram-popup">
      <style>{POPUP_CSS}</style>
      <div className="engram-header">
        <span className="engram-brand engram-brand--md">
          <BrandMark size={20} />
          Engram
        </span>
        <div className="engram-header__right">
          {task && (
            <span className="engram-status">
              Отправлено
              <IconCheckSm />
            </span>
          )}
          {onClose && (
            <button
              type="button"
              className="engram-iconbtn"
              onClick={onClose}
              aria-label="Закрыть"
            >
              <IconClose />
            </button>
          )}
        </div>
      </div>
      {task && (
        <div className="engram-task">
          <p className="engram-task__title">{task.taskTitle}</p>
          <div className="engram-task__meta">
            <span className="engram-tag">{task.platform}</span>
            {task.tags?.map((tag) => (
              <span className="engram-tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

interface ChoiceGroupProps<T extends string> {
  title: string;
  subtitle: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
}

function ChoiceGroup<T extends string>({
  title,
  subtitle,
  options,
  value,
  onChange,
  disabled,
}: ChoiceGroupProps<T>) {
  return (
    <div className="engram-section">
      <div className="engram-section__head">
        <h3 className="engram-section__title">{title}</h3>
        <p className="engram-section__sub">{subtitle}</p>
      </div>
      <div className="engram-choices" role="group" aria-label={title}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className="engram-choice"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
            >
              <span className="engram-choice__label">{opt.label}</span>
              {active && (
                <span className="engram-choice__check" aria-hidden="true">
                  <IconCheckSm />
                </span>
              )}
            </button>
          );
        })}
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

/** Small check used inside the "submitted" chip and the selected-choice badge. */
function IconCheckSm() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

function IconInfo() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export { BrandMark };
