"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "../_api/AuthProvider";

// Client-side route guard for the cabinet. Tokens live in localStorage, so the
// server layout can't gate access — this redirects anonymous users to /login and
// holds rendering until the session is confirmed.
export function CabinetGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="cabinet-guard" role="status" aria-live="polite">
        <span className="cabinet-guard__spinner" aria-hidden="true" />
        <span className="cabinet-guard__label">
          {status === "loading" ? "Проверяем сессию…" : "Перенаправляем на вход…"}
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
