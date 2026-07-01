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
  /** Optional collapse handler for the success state, without forcing a header X. */
  onCollapse?: () => void;
  /** Optional bug-report handler; falls back to opening a GitHub issue. */
  onReport?: () => void;
}

// Difficulty is shown easy → hard (Figma order); the value still maps 1:1 to the
// backend FSRS rating (hard | normal | easy), only the visual order/labels changed.
const DIFFICULTY_OPTIONS: {
  value: UserDifficulty;
  label: string;
  icon: "easy" | "normal" | "hard";
}[] = [
  { value: "easy", label: "Легко", icon: "easy" },
  { value: "normal", label: "Средне", icon: "normal" },
  { value: "hard", label: "Тяжело", icon: "hard" },
];

/** Where "Сообщить об ошибке" points when the host doesn't override it. */
const REPORT_ISSUE_URL =
  "https://github.com/mxdtrip/freeburger/issues/new?labels=extension&title=" +
  encodeURIComponent("Расширение: не распознана задача") +
  "&body=" +
  encodeURIComponent("Страница: \nЧто ожидали: \nЧто произошло: ");
const REVIEWS_URL = "http://localhost:3000/cabinet/reviews";

type Status = "form" | "saving" | "success" | "error";

export function PopupApp({
  submission,
  onSave,
  onClose,
  onCollapse,
  onReport,
}: PopupAppProps) {
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

  function handleCollapse() {
    if (onCollapse) {
      onCollapse();
      return;
    }
    if (onClose) {
      onClose();
      return;
    }
    window.close();
  }

  function handleGoToReviews() {
    window.open(REVIEWS_URL, "_blank", "noopener,noreferrer");
    if (onCollapse) {
      onCollapse();
    } else if (onClose) {
      onClose();
    }
  }

  if (submission === undefined) {
    return (
      <Shell onClose={onClose} compact>
        <div className="realgo-state realgo-state--loading-scene">
          <div className="realgo-spinner" aria-label="Загрузка" />
          <span className="realgo-muted">Определяем задачу…</span>
        </div>
      </Shell>
    );
  }

  if (submission === null) {
    return (
      <Shell onClose={onClose} compact>
        <div className="realgo-state realgo-state--no-task-scene">
          <div className="realgo-state__icon realgo-state__icon--muted" aria-hidden="true">
            <IconExternal />
          </div>
          <p className="realgo-state__text">
            Откройте задачу на NeetCode и отправьте решение — realgo подхватит её
            автоматически.
          </p>
          <button type="button" className="realgo-link" onClick={handleReport}>
            Сообщить об ошибке
          </button>
        </div>
      </Shell>
    );
  }

  if (status === "success") {
    return (
      <Shell onClose={onClose} compact scene="success">
        <div className="realgo-state realgo-state--success-scene">
          <div className="realgo-state__icon realgo-state__icon--success" aria-hidden="true">
            <IconCheck />
          </div>
          <div>
            <p className="realgo-state__title realgo-state__title--success">
              Запланировано
            </p>
            <p className="realgo-muted" style={{ marginTop: 4 }}>
              Задача добавлена в очередь повторений.
            </p>
          </div>
          <div className="realgo-state__actions">
            <button
              type="button"
              className="realgo-btn realgo-btn--ghost realgo-btn--state"
              onClick={handleCollapse}
            >
              Свернуть
            </button>
            <button
              type="button"
              className="realgo-btn realgo-btn--primary realgo-btn--state"
              onClick={handleGoToReviews}
            >
              К повторению
            </button>
          </div>
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
    <Shell task={submission} onClose={onClose} compact>
      <div className="realgo-body">
        <ChoiceGroup
          title="Как далась задача?"
          options={DIFFICULTY_OPTIONS}
          value={difficulty}
          onChange={setDifficulty}
          disabled={saving}
        />
      </div>

      <div className="realgo-foot">
        {status === "error" && (
          <div className="realgo-error" role="alert">
            <span className="realgo-error__icon" aria-hidden="true">
              <IconAlert />
            </span>
            <span className="realgo-error__text">{errorMsg}</span>
            <button className="realgo-error__retry" onClick={handleSave}>
              Повторить
            </button>
          </div>
        )}

        <button
          className="realgo-btn realgo-btn--primary realgo-btn--block realgo-btn--lg"
          disabled={!canSave}
          onClick={handleSave}
        >
          {saving ? (
            <span
              className="realgo-spinner"
              style={{ width: 15, height: 15, borderWidth: 2 }}
            />
          ) : null}
          {saving ? "Сохраняю…" : "Сохранить"}
        </button>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  task,
  onClose,
  compact,
  scene,
}: {
  children: React.ReactNode;
  task?: DetectedSubmission;
  onClose?: () => void;
  compact?: boolean;
  scene?: "success";
}) {
  const className = [
    "realgo-popup",
    compact ? "realgo-popup--compact" : "",
    scene === "success" ? "realgo-popup--success" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <style>{POPUP_CSS}</style>
      <div className="realgo-header">
        <span className="realgo-brand realgo-brand--md">
          <BrandMark size={32} />
          realgo
        </span>
        <div className="realgo-header__right">
          {task && (
            <span className="realgo-status">
              <span className="realgo-status__icon" aria-hidden="true">
                <IconCheckSm />
              </span>
              {task.submitResult === "accepted"
                ? "Вы справились с заданием!"
                : "Результат отправлен"}
            </span>
          )}
          {onClose && (
            <button
              type="button"
              className="realgo-iconbtn"
              onClick={onClose}
              aria-label="Закрыть"
            >
              <IconClose />
            </button>
          )}
        </div>
      </div>
      {task && (
        <div className="realgo-task">
          <p className="realgo-task__title">{task.taskTitle}</p>
          <div className="realgo-task__meta">
            <span className="realgo-tag">{task.platform}</span>
            {task.tags?.map((tag) => (
              <span className="realgo-tag" key={tag}>
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
  options: { value: T; label: string; icon: "easy" | "normal" | "hard" }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
}

function ChoiceGroup<T extends string>({
  title,
  options,
  value,
  onChange,
  disabled,
}: ChoiceGroupProps<T>) {
  return (
    <div className="realgo-section">
      <div className="realgo-section__head">
        <h3 className="realgo-section__title">{title}</h3>
      </div>
      <div className="realgo-choices" role="group" aria-label={title}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className="realgo-choice"
              data-difficulty={opt.icon}
              aria-pressed={active}
              disabled={disabled}
              // Hover selects immediately; moving to another option switches the
              // selection, and leaving the group keeps the last-hovered choice.
              onMouseEnter={() => {
                if (!disabled) onChange(opt.value);
              }}
              onClick={() => onChange(opt.value)}
            >
              <span className="realgo-choice__icon" aria-hidden="true">
                <IconDifficulty kind={opt.icon} />
              </span>
              <span className="realgo-choice__label">{opt.label}</span>
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
      className="realgo-brand__mark"
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

function IconDifficulty({ kind }: { kind: "easy" | "normal" | "hard" }) {
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
