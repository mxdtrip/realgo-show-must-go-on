"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "success" | "error" | "info";

export type ToastInput =
  | string
  | {
      title?: string;
      message: string;
      durationMs?: number;
    };

type ToastRecord = {
  id: string;
  tone: ToastTone;
  title?: string;
  message: string;
  durationMs: number;
};

type ToastContextValue = {
  success: (input: ToastInput) => string;
  error: (input: ToastInput) => string;
  info: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

const DEFAULT_DURATION_MS = 4800;
const TOAST_LIMIT = 5;

const ToastContext = createContext<ToastContextValue | null>(null);

const toastTitle: Record<ToastTone, string> = {
  success: "Готово",
  error: "Ошибка",
  info: "Информация",
};

function normalizeToastInput(input: ToastInput): Omit<ToastRecord, "id" | "tone"> {
  if (typeof input === "string") {
    return {
      message: input,
      durationMs: DEFAULT_DURATION_MS,
    };
  }

  return {
    title: input.title,
    message: input.message,
    durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
  };
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") {
    return (
      <svg viewBox="0 0 24 24" role="img">
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (tone === "error") {
    return (
      <svg viewBox="0 0 24 24" role="img">
        <path d="M12 8v5" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.4 2.7 17.2A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.8L13.7 3.4a2 2 0 0 0-3.4 0Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" role="img">
      <path d="M12 17v-6" />
      <path d="M12 7h.01" />
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextIdRef = useRef(0);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearToastTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (!timer) return;
    clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearToastTimer(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    },
    [clearToastTimer],
  );

  const pushToast = useCallback((tone: ToastTone, input: ToastInput) => {
    const payload = normalizeToastInput(input);
    const id = `toast-${(nextIdRef.current += 1)}`;
    const toast: ToastRecord = {
      id,
      tone,
      title: payload.title,
      message: payload.message,
      durationMs: Math.max(0, payload.durationMs),
    };

    setToasts((current) => [toast, ...current].slice(0, TOAST_LIMIT));

    if (toast.durationMs > 0) {
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((current) => current.filter((item) => item.id !== id));
      }, toast.durationMs);
      timersRef.current.set(id, timer);
    }

    return id;
  }, []);

  useEffect(() => {
    const visibleIds = new Set(toasts.map((toast) => toast.id));
    timersRef.current.forEach((_timer, id) => {
      if (!visibleIds.has(id)) clearToastTimer(id);
    });
  }, [clearToastTimer, toasts]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (input) => pushToast("success", input),
      error: (input) => pushToast("error", input),
      info: (input) => pushToast("info", input),
      dismiss,
    }),
    [dismiss, pushToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section
        className="toast-stack"
        aria-label="Уведомления"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        {toasts.map((toast) => (
          <article
            className={`toast-card toast-card-${toast.tone}`}
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            aria-live={toast.tone === "error" ? "assertive" : "polite"}
          >
            <span className="toast-icon" aria-hidden="true">
              <ToastIcon tone={toast.tone} />
            </span>
            <div className="toast-content">
              <strong>{toast.title ?? toastTitle[toast.tone]}</strong>
              <p>{toast.message}</p>
            </div>
            <button
              className="toast-dismiss"
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={`Закрыть уведомление: ${toast.title ?? toast.message}`}
            >
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="m6 6 12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </article>
        ))}
      </section>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within <ToastProvider>");
  return context;
}
