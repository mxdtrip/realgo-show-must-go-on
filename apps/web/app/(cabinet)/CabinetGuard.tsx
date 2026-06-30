"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "../_api/AuthProvider";

// Dev-only escape hatch: lets the cabinet UI be opened without a session (e.g.
// to work on cabinet pages on mocks before the backend is up). Off unless
// NEXT_PUBLIC_AUTH_BYPASS=1, which is never set in production builds.
const AUTH_BYPASS = process.env.NEXT_PUBLIC_AUTH_BYPASS === "1";

// Client-side route guard for the cabinet. Tokens live in localStorage, so the
// server layout can't gate access — this redirects anonymous users to /login and
// holds rendering until the session is confirmed.
export function CabinetGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!AUTH_BYPASS && status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (AUTH_BYPASS) {
    return <>{children}</>;
  }

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
