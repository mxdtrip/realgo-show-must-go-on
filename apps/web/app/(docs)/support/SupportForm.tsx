"use client";

import { useState } from "react";

const SUPPORT_EMAIL = "mixkageyt@gmail.com";

export function SupportForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject || "Вопрос по realgo",
    )}&body=${encodeURIComponent(message)}`;
    window.location.href = mailto;
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
    </form>
  );
}
