"use client";

import { useState } from "react";

const SUPPORT_EMAIL = "mixkageyt@gmail.com";

export function SupportForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [handoffStarted, setHandoffStarted] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  function composedMessage() {
    return `Кому: ${SUPPORT_EMAIL}\nТема: ${subject || "Вопрос по realgo"}\n\n${message}`;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject || "Вопрос по realgo",
    )}&body=${encodeURIComponent(message)}`;
    window.location.href = mailto;
    setHandoffStarted(true);
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(composedMessage());
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Тема
        <input
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Например: не приходит письмо"
          value={subject}
        />
      </label>
      <label>
        Сообщение
        <textarea
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Опишите, что случилось, и на какой адрес вам ответить"
          required
          rows={5}
          value={message}
        />
      </label>
      <button type="submit">Открыть письмо в почте</button>
      {handoffStarted ? (
        <div role="status" aria-live="polite">
          <p>
            ReAlgo не может проверить, открылся ли почтовый клиент. Если ничего не произошло,
            скопируйте сообщение и отправьте его на {SUPPORT_EMAIL} вручную.
          </p>
          <button type="button" onClick={copyMessage}>
            {copyState === "copied"
              ? "Сообщение скопировано ✓"
              : copyState === "failed"
                ? "Не удалось скопировать — выделите текст вручную"
                : "Скопировать сообщение"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
