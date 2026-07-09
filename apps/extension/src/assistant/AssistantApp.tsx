import { useEffect, useMemo, useRef, useState } from "react";

import type {
  AssistantHintPayload,
  AssistantHintResult,
  AssistantMessage,
  AssistantTask,
} from "../lib/types";
import { ASSISTANT_CSS } from "./assistant.styles";

const BRAND_LOGO_URL = new URL("../../assets/icon.png", import.meta.url).href;
const DEFAULT_MESSAGE = "Я застрял. Дай первую мягкую подсказку, без решения.";

interface AssistantAppProps {
  task: AssistantTask;
  onAsk: (
    payload: AssistantHintPayload,
    onDelta: (text: string) => void
  ) => Promise<AssistantHintResult>;
  variant?: "dock" | "panel";
  onClose?: () => void;
}

type AskStatus = "idle" | "loading";

export function AssistantApp({ task, onAsk, variant = "dock", onClose }: AssistantAppProps) {
  const [open, setOpen] = useState(variant === "panel");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [status, setStatus] = useState<AskStatus>("idle");
  const [error, setError] = useState("");
  const [hintLevel, setHintLevel] = useState(1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const taskKey = `${task.platform}:${task.platformTaskSlug}:${task.taskUrl}`;
  const lastMessage = messages[messages.length - 1];
  const isStreamingEmpty =
    status === "loading" && lastMessage?.role === "assistant" && lastMessage.content === "";
  const visibleTags = useMemo(
    () =>
      [task.platform, task.difficulty, ...(task.tags ?? [])]
        .filter((tag): tag is string => Boolean(tag))
        .slice(0, 5),
    [task.platform, task.difficulty, task.tags]
  );

  useEffect(() => {
    if (variant === "panel") setOpen(true);
    setMessages([]);
    setStatus("idle");
    setError("");
    setHintLevel(1);
  }, [taskKey, variant]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status, error]);

  useEffect(() => {
    // `error` must gate this: without it, a failed first ask() resets status
    // back to "idle" with messages still empty, so this effect re-fires and
    // silently retries — back-to-back failures then look like the spinner
    // never stopping instead of a visible error.
    if (!open || status !== "idle" || messages.length > 0 || error) return;
    void ask(DEFAULT_MESSAGE, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskKey, status, messages.length, error]);

  async function ask(message: string, showUserMessage = true) {
    const trimmed = message.trim();
    if (!trimmed || status === "loading") return;

    const history = messages.slice(-8);
    const isFirstAssistantMessage = !messages.some((item) => item.role === "assistant");
    if (showUserMessage) {
      setMessages((items) => [...items, { role: "user", content: trimmed }]);
    }
    setStatus("loading");
    setError("");
    // Placeholder the streamed reply fills in as fragments arrive; it's
    // always the last item until `ask` replaces or drops it below.
    setMessages((items) => [...items, { role: "assistant", content: "" }]);

    try {
      const result = await onAsk(
        { ...task, message: trimmed, hintLevel, history },
        (delta) => appendToLastAssistantMessage(delta)
      );
      setMessages((items) => replaceLastMessage(items, formatHint(result, isFirstAssistantMessage)));
      setHintLevel((level) => Math.min(level + 1, 5));
    } catch (e) {
      setMessages((items) => items.slice(0, -1));
      setError(e instanceof Error ? e.message : "AI-помощник сейчас недоступен.");
    } finally {
      setStatus("idle");
    }
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
    if (variant === "dock") setOpen(false);
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
    <div className={`realgo-assistant realgo-assistant--open realgo-assistant--${variant}`}>
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
              <p>Вижу открытую задачу. Нажми на агент или выбери быстрый запрос — буду вести по одному шагу.</p>
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

        <div className="realgo-agent-actions">
          <button
            type="button"
            className="realgo-agent-btn"
            disabled={status === "loading"}
            onClick={() => ask("Дай следующий намёк, но всё ещё без полного решения.")}
          >
            следующий намёк
          </button>
          <button
            type="button"
            className="realgo-agent-btn"
            disabled={status === "loading"}
            onClick={() => ask("Я не уверен в выбранном паттерне. Помоги распознать его мягко.")}
          >
            паттерн?
          </button>
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
    case "neetcode":
      return "realgo-agent-tag--neetcode";
    default:
      return "";
  }
}

function formatHint(result: AssistantHintResult, showContext: boolean): string {
  const parts = [stageLabel(result.stage), result.hint.trim()];
  if (result.question?.trim()) {
    parts.push(`Вопрос: ${result.question.trim()}`);
  }
  // Only surface the connected-pattern context on the first reply — it's the
  // same context every turn, so repeating it on each hint just adds noise.
  if (showContext && result.problemKnown && result.patterns?.length) {
    const names = result.patterns.slice(0, 2).map((pattern) => pattern.name).join(", ");
    parts.push(`Контекст realgo: ${names}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

function stageLabel(stage: AssistantHintResult["stage"]): string {
  switch (stage) {
    case "pattern":
      return "паттерн";
    case "invariant":
      return "инвариант";
    case "next_step":
      return "следующий шаг";
    case "debug":
      return "debug";
    case "nudge":
    default:
      return "наводка";
  }
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
