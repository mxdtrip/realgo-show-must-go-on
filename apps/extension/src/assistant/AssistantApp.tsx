import { useEffect, useMemo, useRef, useState } from "react";

import { getAssistantState, setAssistantState } from "../lib/storage";
import {
  ASSISTANT_STATE_KEY_PREFIX,
  type AssistantHintPayload,
  type AssistantHintResult,
  type AssistantMessage,
  type AssistantPattern,
  type AssistantPersistedState,
  type AssistantTask,
} from "../lib/types";
import { ASSISTANT_CSS } from "./assistant.styles";

const BRAND_LOGO_URL = new URL("../../assets/icon.png", import.meta.url).href;
const FIRST_MESSAGE = "Я застрял. Дай первую мягкую подсказку, без решения.";
const NEXT_MESSAGE = "Дай следующий намёк, но всё ещё без полного решения.";
// Keep in sync with maxAssistantHintLevel in services/api/internal/ai/assistant_handler.go.
const MAX_HINTS = 3;
const HINT_COOLDOWN_MS = 30_000;
// Must cover the panel-out animation in assistant.styles.ts (0.18s).
const COLLAPSE_MS = 200;

interface AssistantAppProps {
  task: AssistantTask;
  onAsk: (
    payload: AssistantHintPayload,
    onDelta: (text: string) => void,
    signal?: AbortSignal
  ) => Promise<AssistantHintResult>;
  variant?: "dock" | "panel";
  onClose?: () => void;
}

type AskStatus = "idle" | "loading";

export function AssistantApp({ task, onAsk, variant = "dock", onClose }: AssistantAppProps) {
  const [open, setOpen] = useState(variant === "panel");
  const [closing, setClosing] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [status, setStatus] = useState<AskStatus>("idle");
  const [error, setError] = useState("");
  const [hintLevel, setHintLevel] = useState(1);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [cooldownEndAt, setCooldownEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [patterns, setPatterns] = useState<AssistantPattern[] | undefined>();
  const [problemKnown, setProblemKnown] = useState(false);
  const [patternUsed, setPatternUsed] = useState(false);
  // Blocks persistence until the stored state for the current task has been
  // loaded — otherwise the initial empty state would clobber it on mount.
  const [hydrated, setHydrated] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Aborts an in-flight ask() when this component unmounts (SPA navigation
  // to a new task tears down the whole dock/panel, see contents/realgo.ts
  // removeAssistant) — otherwise the background keeps streaming a reply
  // nobody's left to see.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const taskKey = `${task.platform}:${task.platformTaskSlug}:${task.taskUrl}`;
  const lastMessage = messages[messages.length - 1];
  const isStreamingEmpty =
    status === "loading" && lastMessage?.role === "assistant" && lastMessage.content === "";
  const hintsExhausted = hintsUsed >= MAX_HINTS;
  const cooldownRemainingMs = cooldownEndAt ? Math.max(0, cooldownEndAt - now) : 0;
  const isCoolingDown = cooldownRemainingMs > 0;
  const cooldownProgress = cooldownEndAt ? 1 - cooldownRemainingMs / HINT_COOLDOWN_MS : 1;
  const visibleTags = useMemo(
    () =>
      [task.platform, task.difficulty, ...(task.tags ?? [])]
        .filter((tag): tag is string => Boolean(tag))
        .slice(0, 5),
    [task.platform, task.difficulty, task.tags]
  );

  useEffect(() => {
    if (variant === "panel") setOpen(true);
    setHydrated(false);
    setMessages([]);
    setStatus("idle");
    setError("");
    setHintLevel(1);
    setHintsUsed(0);
    setCooldownEndAt(null);
    setPatterns(undefined);
    setProblemKnown(false);
    setPatternUsed(false);

    // Rehydrate this task's conversation: the toolbar popup unmounts on every
    // close, and without this each reopen would grant a fresh hint set.
    let alive = true;
    getAssistantState(taskKey)
      .then((saved) => {
        if (!alive || !saved) return;
        setMessages(saved.messages);
        setHintLevel(saved.hintLevel);
        setHintsUsed(saved.hintsUsed);
        setCooldownEndAt(saved.cooldownEndAt);
        setPatterns(saved.patterns);
        setProblemKnown(saved.problemKnown);
        setPatternUsed(saved.patternUsed);
        setNow(Date.now());
      })
      .catch(() => {
        /* no stored state — start fresh */
      })
      .finally(() => {
        if (alive) setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, [taskKey, variant]);

  // Persist after each completed exchange (not mid-stream: the placeholder
  // message and per-delta updates would spam storage with partial states).
  useEffect(() => {
    if (!hydrated || status !== "idle") return;
    void setAssistantState(taskKey, {
      messages,
      hintLevel,
      hintsUsed,
      cooldownEndAt,
      patterns,
      problemKnown,
      patternUsed,
      savedAt: Date.now(),
    }).catch(() => {
      /* persistence is best-effort */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, status, messages, hintsUsed, patternUsed, cooldownEndAt]);

  // The in-page dock and the toolbar popup are two independent mounts of
  // this component for the same task, each with its own local state — with
  // no cross-instance sync, both let the user ask a hint at "the same time"
  // (hintsUsed/cooldown are enforced client-side per mount), doubling the
  // LLM calls MAX_HINTS is meant to cap. chrome.storage.onChanged fires in
  // every extension context on any chrome.storage.local write, including
  // ones made elsewhere — used here to pull in whatever the other mount
  // just persisted instead of only ever reading storage once on mount.
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    const key = ASSISTANT_STATE_KEY_PREFIX + taskKey;
    function onStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) {
      if (areaName !== "local" || !(key in changes)) return;
      const next = changes[key].newValue as AssistantPersistedState | undefined;
      if (!next) return;
      setMessages(next.messages);
      setHintLevel(next.hintLevel);
      setHintsUsed(next.hintsUsed);
      setCooldownEndAt(next.cooldownEndAt);
      setPatterns(next.patterns);
      setProblemKnown(next.problemKnown);
      setPatternUsed(next.patternUsed);
    }
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [taskKey]);

  // Ticks `now` while a cooldown is running so the recharge bar/countdown
  // stay live; stops itself once the cooldown has actually elapsed.
  useEffect(() => {
    if (cooldownEndAt === null) return;
    const id = setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= cooldownEndAt) clearInterval(id);
    }, 200);
    return () => clearInterval(id);
  }, [cooldownEndAt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status, error]);

  // No auto-ask on open: the first hint costs an LLM call, so it must be an
  // explicit button press. (The old auto-ask fired on every popup mount —
  // collapse/expand regenerated the first hint and burned quota each time.)

  async function ask(message: string, showUserMessage = true) {
    const trimmed = message.trim();
    if (!trimmed || status === "loading" || hintsUsed >= MAX_HINTS || !hydrated) return;

    const history = messages.slice(-8);
    if (showUserMessage) {
      setMessages((items) => [...items, { role: "user", content: trimmed }]);
    }
    setStatus("loading");
    setError("");
    // Placeholder the streamed reply fills in as fragments arrive; it's
    // always the last item until `ask` replaces or drops it below.
    setMessages((items) => [...items, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await onAsk(
        { ...task, message: trimmed, hintLevel, history },
        (delta) => appendToLastAssistantMessage(delta),
        controller.signal
      );
      setMessages((items) => replaceLastMessage(items, formatHint(result)));
      setHintLevel((level) => Math.min(level + 1, MAX_HINTS));
      setPatterns(result.patterns);
      setProblemKnown(result.problemKnown);
      const usedAfterThis = hintsUsed + 1;
      setHintsUsed(usedAfterThis);
      setCooldownEndAt(usedAfterThis < MAX_HINTS ? Date.now() + HINT_COOLDOWN_MS : null);
    } catch (e) {
      // Aborted because the component unmounted mid-request — nothing left
      // to show an error to, and touching state here is pointless.
      if (controller.signal.aborted) return;
      setMessages((items) => items.slice(0, -1));
      setError(e instanceof Error ? e.message : "AI-помощник сейчас недоступен.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (!controller.signal.aborted) setStatus("idle");
    }
  }

  // Reveals the known taxonomy pattern directly from data already returned
  // by the last hint — this is not itself a hint, so it doesn't touch
  // hintsUsed/cooldown, but it's a one-shot reveal: once used for this task
  // there's nothing left to ask it again for.
  function revealPattern() {
    if (status === "loading" || patternUsed) return;
    const text =
      problemKnown && patterns && patterns.length > 0
        ? `Паттерн: ${patterns.slice(0, 2).map((pattern) => pattern.name).join(", ")}`
        : "Эта задача пока не привязана к паттерну в базе realgo — попробуй определить его по тегам и условию самостоятельно.";
    setMessages((items) => [...items, { role: "assistant", content: text }]);
    setPatternUsed(true);
  }

  function appendToLastAssistantMessage(delta: string) {
    setMessages((items) => {
      const last = items[items.length - 1];
      if (!last || last.role !== "assistant") return items;
      return replaceLastMessage(items, last.content + delta);
    });
  }

  function handleClose() {
    if (onClose) {
      onClose();
      return;
    }
    // Dock collapse plays the panel-out animation first, then unmounts the
    // panel; `closing` keeps it rendered for the animation's duration.
    if (variant === "dock" && !closing) {
      setClosing(true);
      window.setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, COLLAPSE_MS);
    }
  }

  if (!open) {
    return (
      <div className="realgo-assistant realgo-assistant--closed">
        <style>{ASSISTANT_CSS}</style>
        <button type="button" className="realgo-agent-button" onClick={() => setOpen(true)}>
          <img className="realgo-agent-logo" src={BRAND_LOGO_URL} alt="" />
          ReAlgo
        </button>
      </div>
    );
  }

  return (
    <div
      className={`realgo-assistant realgo-assistant--open realgo-assistant--${variant} ${
        closing ? "realgo-assistant--closing" : ""
      }`}
    >
      <style>{ASSISTANT_CSS}</style>
      <section className="realgo-agent-panel" aria-label="realgo AI assistant">
        <header className="realgo-agent-header">
          <span className="realgo-agent-brand">
            <img className="realgo-agent-logo" src={BRAND_LOGO_URL} alt="" />
            ReAlgo
            <span className="realgo-agent-path">~/agent</span>
          </span>
          <span className="realgo-agent-status">
            <span className="realgo-agent-status__dot" aria-hidden="true" />
            задача открыта
          </span>
          <button
            type="button"
            className="realgo-agent-iconbtn"
            onClick={handleClose}
            aria-label="Свернуть AI-помощник"
          >
            {onClose ? <IconClose /> : <IconMinus />}
          </button>
        </header>

        <div className="realgo-agent-task">
          <p className="realgo-agent-title">{task.taskTitle}</p>
          <div className="realgo-agent-tags">
            {visibleTags.map((tag) => (
              <span
                className={`realgo-agent-tag ${difficultyTagClass(tag, task.difficulty)} ${platformTagClass(tag, task.platform)}`}
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="realgo-agent-messages" role="log" aria-live="polite">
          {messages.map((message, index) => {
            // The streamed placeholder still has no text: show the spinner
            // in its place below instead of an empty bubble.
            if (index === messages.length - 1 && isStreamingEmpty) return null;
            return (
              <article
                className={`realgo-agent-msg realgo-agent-msg--${message.role}`}
                key={`${message.role}-${index}`}
              >
                <span className="realgo-agent-msg__role">
                  {message.role === "assistant" ? "agent" : "you"}
                </span>
                <p>{message.content}</p>
              </article>
            );
          })}
          {messages.length === 0 && status === "idle" && !error && (
            <article className="realgo-agent-msg realgo-agent-msg--assistant">
              <span className="realgo-agent-msg__role">agent</span>
              <p>
                Вижу открытую задачу. Нажми «получить подсказку» — начну с мягкой наводки,
                без решения. Всего подсказок {MAX_HINTS}, каждая следующая конкретнее.
              </p>
            </article>
          )}
          {isStreamingEmpty && (
            <div className="realgo-agent-loading">
              <span className="realgo-agent-spinner" aria-hidden="true" />
              думаю над следующей наводкой…
            </div>
          )}
          {error && <p className="realgo-agent-error">{error}</p>}
          <div ref={bottomRef} />
        </div>

        <div className="realgo-agent-actions-wrap">
          <div className="realgo-agent-actions">
            <button
              type="button"
              className="realgo-agent-btn realgo-agent-btn--hint"
              disabled={status === "loading" || hintsExhausted || isCoolingDown || !hydrated}
              onClick={() =>
                hintsUsed === 0 ? ask(FIRST_MESSAGE, false) : ask(NEXT_MESSAGE)
              }
            >
              {isCoolingDown && (
                <span
                  className="realgo-agent-btn__fill"
                  aria-hidden="true"
                  style={{ width: `${Math.round(cooldownProgress * 100)}%` }}
                />
              )}
              <span className="realgo-agent-btn__label">
                {isCoolingDown
                  ? `через ${Math.ceil(cooldownRemainingMs / 1000)}с`
                  : hintsUsed === 0
                    ? "получить подсказку"
                    : "следующий намёк"}
              </span>
            </button>
            <button
              type="button"
              className="realgo-agent-btn"
              disabled={status === "loading" || patternUsed}
              onClick={revealPattern}
            >
              паттерн
            </button>
          </div>
          {hintsExhausted && (
            <p className="realgo-agent-hints-done">
              Подсказки для этой задачи закончились — на следующей задаче они появятся снова.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function IconClose() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function replaceLastMessage(items: AssistantMessage[], content: string): AssistantMessage[] {
  if (items.length === 0) return items;
  return [...items.slice(0, -1), { role: "assistant", content }];
}

function difficultyTagClass(tag: string, difficulty?: string): string {
  if (!difficulty || tag.toLowerCase() !== difficulty.toLowerCase()) return "";
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "realgo-agent-tag--easy";
    case "medium":
      return "realgo-agent-tag--medium";
    case "hard":
      return "realgo-agent-tag--hard";
    default:
      return "";
  }
}

function platformTagClass(tag: string, platform: string): string {
  if (tag.toLowerCase() !== platform.toLowerCase()) return "";
  switch (platform.toLowerCase()) {
    case "leetcode":
      return "realgo-agent-tag--leetcode";
    case "hackerrank":
      return "realgo-agent-tag--hackerrank";
    case "geeksforgeeks":
      return "realgo-agent-tag--geeksforgeeks";
    case "codeforces":
      return "realgo-agent-tag--codeforces";
    default:
      return "";
  }
}

function formatHint(result: AssistantHintResult): string {
  const parts = [result.hint.trim()];
  if (result.question?.trim()) {
    parts.push(`Вопрос: ${result.question.trim()}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

function IconMinus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}
