import { useState } from "react";

import type {
  DetectedSubmission,
  ExtensionEventResult,
  ProblemCardsResult,
  SubmissionPayload,
  UserDifficulty,
} from "../lib/types";
import { DEFAULT_WEB_BASE_URL, REVIEW_PATH } from "../lib/types";
import { POPUP_CSS } from "./popup.styles";
import { useProblemCards, type CardsUiState } from "./useProblemCards";

const BRAND_LOGO_URL = new URL("../../assets/icon.png", import.meta.url).href;

export interface PopupAppProps {
  /**
   * undefined → still detecting (loading);
   * null      → no task detected on the page;
   * object    → show the rating form.
   */
  submission: DetectedSubmission | null | undefined;
  /**
   * Persists the rated submission. Rejects with an Error on failure. The
   * resolved event result feeds the cards-readiness poll (its `problemId`);
   * `null` simply means "no polling" — the success screen stays as before.
   */
  onSave: (payload: SubmissionPayload) => Promise<ExtensionEventResult | null>;
  /**
   * One poll tick of the task's cards readiness. Injected by the host (the
   * extension routes it through the background worker; the preview mocks it)
   * so PopupApp itself stays a pure view with no chrome.* access. Absent →
   * the cards block never renders.
   */
  onFetchCards?: (problemId: number) => Promise<ProblemCardsResult | null>;
  /**
   * "Скрыть" on the success screen — hides the extension UI until the next
   * solved task (overlay: removes itself; toolbar popup: closes the window).
   */
  onClose?: () => void;
  /** Optional collapse handler for the success state, without forcing a header X. */
  onCollapse?: () => void;
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
const REVIEWS_URL = DEFAULT_WEB_BASE_URL + REVIEW_PATH;

type Status = "form" | "saving" | "success" | "error";

export function PopupApp({
  submission,
  onSave,
  onFetchCards,
  onClose,
  onCollapse,
  onReview,
  onReport,
}: PopupAppProps) {
  const [difficulty, setDifficulty] = useState<UserDifficulty | null>(null);
  const [status, setStatus] = useState<Status>("form");
  const [errorMsg, setErrorMsg] = useState("");
  // The saved event's problemId; set on success, drives the cards poll.
  const [problemId, setProblemId] = useState<number | null>(null);
  const cardsState = useProblemCards(
    status === "success" ? problemId : null,
    onFetchCards
  );

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
    // Prefer the host's review handler (toolbar popup opens the web app's cards
    // via getReviewUrl and closes itself); fall back to a direct URL otherwise.
    if (onReview) {
      onReview();
      return;
    }
    window.open(REVIEWS_URL, "_blank", "noopener,noreferrer");
    if (onCollapse) {
      onCollapse();
    } else if (onClose) {
      onClose();
    }
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
            Откройте задачу на HackerRank и отправьте решение — realgo подхватит её
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
          {cardsState !== "hidden" && (
            <CardsStatusRow state={cardsState} onOpen={handleGoToReviews} />
          )}
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

  // A dedicated screen (like success) keeps the popup size fixed: an inline
  // banner would not fit into the fixed-height form layout.
  if (status === "error") {
    return (
      <Shell onClose={onClose}>
        <div className="realgo-state realgo-state--error-scene">
          <div className="realgo-state__icon realgo-state__icon--danger" aria-hidden="true">
            <IconAlert size={20} />
          </div>
          <div>
            <p className="realgo-state__title realgo-state__title--danger">
              Не удалось сохранить
            </p>
            <p className="realgo-muted" style={{ marginTop: 4 }}>
              {errorMsg}
            </p>
          </div>
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
              onClick={() => difficulty && handlePick(difficulty)}
            >
              Повторить
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  const saving = status === "saving";

  // Picking a difficulty is the save action — there is no separate button.
  async function handlePick(value: UserDifficulty) {
    if (saving || submission == null) return;
    setDifficulty(value);
    setStatus("saving");
    setErrorMsg("");
    const payload: SubmissionPayload = {
      ...submission,
      userDifficulty: value,
    };
    try {
      const result = await onSave(payload);
      // A malformed/absent problemId only disables the cards poll — the save
      // itself succeeded and the success screen must not depend on it.
      setProblemId(
        typeof result?.problemId === "number" && result.problemId > 0
          ? result.problemId
          : null
      );
      setStatus("success");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Не удалось сохранить.");
    }
  }

  return (
    <Shell task={submission} onClose={onClose}>
      <div className="realgo-body">
        <ChoiceGroup
          title="Как далась задача?"
          options={DIFFICULTY_OPTIONS}
          value={difficulty}
          onPick={handlePick}
          disabled={saving}
        />
        <p className="realgo-hint" role="status">
          {saving ? (
            <>
              <span
                className="realgo-spinner"
                style={{ width: 13, height: 13, borderWidth: 2 }}
              />
              сохраняю…
            </>
          ) : (
            "Выберите сложность — realgo сохранит результат"
          )}
        </p>
      </div>
    </Shell>
  );
}

/**
 * One-line cards readiness on the success screen. Colors follow the project
 * rule: the working indicator is accent-blue, green marks success only.
 * The "hidden" state never reaches here — the caller skips rendering.
 */
function CardsStatusRow({
  state,
  onOpen,
}: {
  state: Exclude<CardsUiState, "hidden">;
  onOpen: () => void;
}) {
  return (
    <p className={`realgo-cards realgo-cards--${state}`} role="status">
      {state === "generating" && (
        <>
          <span
            className="realgo-spinner"
            style={{ width: 13, height: 13, borderWidth: 2 }}
            aria-hidden="true"
          />
          Генерируем карточки по задаче…
        </>
      )}
      {state === "ready" && (
        <>
          <span className="realgo-cards__check" aria-hidden="true">
            <IconCheck size={13} />
          </span>
          Карточки готовы
          <button type="button" className="realgo-link realgo-cards__open" onClick={onOpen}>
            открыть
          </button>
        </>
      )}
      {state === "none" && <>Карточки к задаче пока не готовы</>}
    </p>
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
            <span className={`realgo-tag ${platformTagClass(task.platform)}`}>{task.platform}</span>
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
  onPick: (value: T) => void;
  disabled?: boolean;
}

function ChoiceGroup<T extends string>({
  title,
  options,
  value,
  onPick,
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
              // Clicking a difficulty is the save action (no separate button).
              onClick={() => onPick(opt.value)}
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

function IconCheck({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
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

function platformTagClass(platform: string): string {
  switch (platform.toLowerCase()) {
    case "leetcode":
      return "realgo-tag--leetcode";
    case "hackerrank":
      return "realgo-tag--hackerrank";
    default:
      return "";
  }
}

export { BrandMark };
