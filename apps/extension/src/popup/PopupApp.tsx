import { useState } from "react";

import type {
  CanSolveAgain,
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
}

const DIFFICULTY_OPTIONS: { value: UserDifficulty; label: string }[] = [
  { value: "hard", label: "Тяжело" },
  { value: "normal", label: "Нормально" },
  { value: "easy", label: "Легко" },
];

const AGAIN_OPTIONS: { value: CanSolveAgain; label: string }[] = [
  { value: "no", label: "Нет" },
  { value: "probably", label: "Скорее да" },
  { value: "yes", label: "Да" },
];

type Status = "form" | "saving" | "success" | "error";

export function PopupApp({ submission, onSave, onClose }: PopupAppProps) {
  const [difficulty, setDifficulty] = useState<UserDifficulty | null>(null);
  const [again, setAgain] = useState<CanSolveAgain | null>(null);
  const [status, setStatus] = useState<Status>("form");
  const [errorMsg, setErrorMsg] = useState("");

  if (submission === undefined) {
    return (
      <Shell>
        <div className="engram-center">
          <div className="engram-spinner" aria-label="Загрузка" />
          <span className="engram-muted">Определяем задачу…</span>
        </div>
      </Shell>
    );
  }

  if (submission === null) {
    return (
      <Shell>
        <div className="engram-center">
          <span className="engram-success-title">Задача не найдена</span>
          <span className="engram-muted">
            Откройте страницу задачи на NeetCode и отправьте решение.
          </span>
        </div>
      </Shell>
    );
  }

  if (status === "success") {
    return (
      <Shell>
        <div className="engram-center">
          <div className="engram-success-mark">✓</div>
          <span className="engram-success-title">Сохранено в Engram</span>
          <span className="engram-muted">
            Задача добавлена в очередь повторений.
          </span>
          {onClose && (
            <button className="engram-link-btn" onClick={onClose}>
              Закрыть
            </button>
          )}
        </div>
      </Shell>
    );
  }

  const saving = status === "saving";
  const canSave = difficulty !== null && again !== null && !saving;

  async function handleSave() {
    if (difficulty === null || again === null || submission == null) return;
    setStatus("saving");
    setErrorMsg("");
    const payload: SubmissionPayload = {
      ...submission,
      userDifficulty: difficulty,
      canSolveAgain: again,
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
    <Shell>
      <div className="engram-saved-label">Задача сохранена</div>
      <h1 className="engram-task-title">{submission.taskTitle}</h1>
      <div className="engram-task-meta">{submission.taskUrl}</div>

      <ChoiceGroup
        label="Как далась задача?"
        options={DIFFICULTY_OPTIONS}
        value={difficulty}
        onChange={setDifficulty}
        disabled={saving}
        toneClass={(v) => `engram-choice--${v}`}
      />

      <ChoiceGroup
        label="Сможешь решить заново без подсказки?"
        options={AGAIN_OPTIONS}
        value={again}
        onChange={setAgain}
        disabled={saving}
        toneClass={(v) => `engram-choice--${v}`}
      />

      {status === "error" && <div className="engram-error">{errorMsg}</div>}

      <button className="engram-save" disabled={!canSave} onClick={handleSave}>
        {saving ? "Сохранение…" : status === "error" ? "Повторить" : "Сохранить"}
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="engram-popup">
      <style>{POPUP_CSS}</style>
      <div className="engram-brand">Engram</div>
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
  toneClass: (value: T) => string;
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  toneClass,
}: ChoiceGroupProps<T>) {
  return (
    <div className="engram-question">
      <div className="engram-question__label">{label}</div>
      <div className="engram-choices" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`engram-choice ${toneClass(opt.value)}`}
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
