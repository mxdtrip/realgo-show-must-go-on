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
  onAsk: (payload: AssistantHintPayload) => Promise<AssistantHintResult>;
  variant?: "dock" | "panel";
  onClose?: () => void;
}

type AskStatus = "idle" | "loading";

export function AssistantApp({ task, onAsk, variant = "dock", onClose }: AssistantAppProps) {
  const [open, setOpen] = useState(variant === "panel");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<AskStatus>("idle");
  const [error, setError] = useState("");
  const [hintLevel, setHintLevel] = useState(1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const taskKey = `${task.platform}:${task.platformTaskSlug}:${task.taskUrl}`;
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
    setInput("");
    setStatus("idle");
    setError("");
    setHintLevel(1);
  }, [taskKey, variant]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status, error]);

  useEffect(() => {
    if (!open || status !== "idle" || messages.length > 0) return;
    void ask(DEFAULT_MESSAGE, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskKey, status, messages.length]);

  async function ask(message: string, showUserMessage = true) {
    const trimmed = message.trim();
    if (!trimmed || status === "loading") return;

    const history = messages.slice(-8);
    if (showUserMessage) {
      setMessages((items) => [...items, { role: "user", content: trimmed }]);
    }
    setStatus("loading");
    setError("");

    try {
      const result = await onAsk({
        ...task,
        message: trimmed,
        hintLevel,
        history,
      });
      setMessages((items) => [
        ...items,
        { role: "assistant", content: formatHint(result) },
      ]);
      setHintLevel((level) => Math.min(level + 1, 5));
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI-помощник сейчас недоступен.");
    } finally {
      setStatus("idle");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input;
    setInput("");
    void ask(value);
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
          AI hint
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
          <div className="realgo-agent-task__top">
            <span className="realgo-agent-eyebrow">режим подсказок</span>
            <span className="realgo-agent-safe">без кода · без полного решения</span>
          </div>
          <p className="realgo-agent-title">{task.taskTitle}</p>
          <div className="realgo-agent-tags">
            {visibleTags.map((tag) => (
              <span className="realgo-agent-tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="realgo-agent-messages" role="log" aria-live="polite">
          {messages.map((message, index) => (
            <article
              className={`realgo-agent-msg realgo-agent-msg--${message.role}`}
              key={`${message.role}-${index}`}
            >
              <span className="realgo-agent-msg__role">
                {message.role === "assistant" ? "agent" : "you"}
              </span>
              <p>{message.content}</p>
            </article>
          ))}
          {messages.length === 0 && status === "idle" && !error && (
            <article className="realgo-agent-msg realgo-agent-msg--assistant">
              <span className="realgo-agent-msg__role">agent</span>
              <p>Вижу открытую задачу. Нажми на агент или выбери быстрый запрос — буду вести по одному шагу.</p>
            </article>
          )}
          {status === "loading" && (
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

        <form className="realgo-agent-form" onSubmit={handleSubmit}>
          <input
            className="realgo-agent-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="где именно застрял?"
            disabled={status === "loading"}
          />
          <button
            type="submit"
            className="realgo-agent-btn"
            disabled={status === "loading" || input.trim() === ""}
          >
            спросить
          </button>
        </form>
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

function formatHint(result: AssistantHintResult): string {
  const parts = [stageLabel(result.stage), result.hint.trim()];
  if (result.question?.trim()) {
    parts.push(`Вопрос: ${result.question.trim()}`);
  }
  if (result.problemKnown && result.patterns?.length) {
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
