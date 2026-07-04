import { useState } from "react";

import type {
  DetectedSubmission,
  SubmissionPayload,
  UserDifficulty,
} from "../lib/types";
import { POPUP_CSS } from "./popup.styles";

const BRAND_LOGO_URL = new URL("../../assets/icon.png", import.meta.url).href;

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
   * "Свернуть" on the success screen — hides the extension UI until the next
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
      <Shell onClose={onClose}>
        <div className="realgo-state realgo-state--loading-scene">
          <div className="realgo-spinner" aria-label="Загрузка" />
          <span className="realgo-muted">определяем задачу…</span>
        </div>
      </Shell>
    );
  }

  if (submission === null) {
    return (
      <Shell onClose={onClose}>
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
      <Shell onClose={onClose} scene="success">
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
          {(onClose || onReview) && (
            <div className="realgo-state__actions">
              {onClose && (
                <button
                  type="button"
                  className="realgo-btn realgo-btn--ghost realgo-btn--state"
                  onClick={onClose}
                >
                  Свернуть
                </button>
              )}
              {onReview && (
                <button
                  type="button"
                  className="realgo-btn realgo-btn--primary realgo-btn--state"
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

  if (status === "error") {
    return (
      <Shell onClose={onClose}>
        <div className="realgo-state realgo-state--error-scene">
          <div className="realgo-state__icon realgo-state__icon--danger" aria-hidden="true">
            <IconAlert size={20} />
          </div>
          <p className="realgo-state__error" role="alert">
            {errorMsg}
          </p>
          <div className="realgo-state__actions">
            <button
              type="button"
              className="realgo-btn realgo-btn--ghost realgo-btn--state"
              onClick={() => setStatus("form")}
            >
              Назад
            </button>
            <button
              type="button"
              className="realgo-btn realgo-btn--primary realgo-btn--state"
              onClick={handleSave}
            >
              Повторить
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
    <Shell task={submission} onClose={onClose}>
      <div className="realgo-body">
        <div className="realgo-body__center">
          <ChoiceGroup
            title="Как далась задача?"
            options={DIFFICULTY_OPTIONS}
            value={difficulty}
            onChange={setDifficulty}
            disabled={saving}
          />
        </div>

        <div className="realgo-foot">
          <button
            type="button"
            className="realgo-btn realgo-btn--primary realgo-btn--block realgo-btn--lg"
            disabled={!canSave}
            onClick={handleSave}
          >
            {saving ? (
              <span
                className="realgo-spinner"
                style={{ width: 14, height: 14, borderWidth: 2 }}
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
  scene,
}: {
  children: React.ReactNode;
  task?: DetectedSubmission;
  onClose?: () => void;
  scene?: "success";
}) {
  const className = [
    "realgo-popup",
    scene === "success" ? "realgo-popup--success" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <style>{POPUP_CSS}</style>
      <div className="realgo-header">
        <span className="realgo-brand">
          <BrandMark size={20} />
          ReAlgo
          <span className="realgo-path">~/ext</span>
        </span>
        <div className="realgo-header__right">
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
          <span className="realgo-eyebrow">Задача выполнена успешно!</span>
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
    <img
      alt=""
      aria-hidden="true"
      className="realgo-brand__mark"
      decoding="async"
      height={size}
      src={BRAND_LOGO_URL}
      width={size}
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

function IconAlert({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
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
