"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "../_api/AuthProvider";
import { ApiError } from "../_api/types";

type Mode = "login" | "register";

const COPY = {
  login: {
    aria: "Вход в ReAlgo",
    submit: "Войти",
    pending: "Входим…",
    redirect: "/dashboard",
  },
  register: {
    aria: "Регистрация в ReAlgo",
    submit: "Создать аккаунт",
    pending: "Создаём…",
    redirect: "/onboarding/profile",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const auth = useAuth();
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (mode === "register" && !consent) return;
    setPending(true);
    setError("");
    try {
      if (mode === "login") {
        const authUser = await auth.login(email.trim(), password);
        router.push(authUser.onboarding_completed ? "/dashboard" : "/onboarding/profile");
      } else {
        const authUser = await auth.register(email.trim(), password);
        router.push(authUser.onboarding_completed ? "/dashboard" : "/onboarding/profile");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Что-то пошло не так. Попробуйте ещё раз.");
      setPending(false);
    }
  }

  return (
    <section aria-label={copy.aria} className="auth-panel">
      <div className="auth-tabs">
        <Link className={mode === "login" ? "active" : ""} href="/login">
          Вход
        </Link>
        <Link className={mode === "register" ? "active" : ""} href="/register">
          Регистрация
        </Link>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            autoComplete="email"
            placeholder="you@example.com"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </label>
        <label>
          Пароль
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "register" ? "минимум 8 символов" : "••••••••"}
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
        </label>

        {mode === "register" ? (
          <label className="auth-consent">
            <input
              checked={consent}
              disabled={pending}
              onChange={(e) => setConsent(e.target.checked)}
              required
              type="checkbox"
            />
            <span>
              Принимаю{" "}
              <Link href="/terms" target="_blank">
                Условия использования
              </Link>{" "}
              и{" "}
              <Link href="/privacy" target="_blank">
                Политику конфиденциальности
              </Link>
            </span>
          </label>
        ) : null}

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        <button disabled={pending || (mode === "register" && !consent)} type="submit">
          {pending ? copy.pending : copy.submit}
        </button>
      </form>
    </section>
  );
}
