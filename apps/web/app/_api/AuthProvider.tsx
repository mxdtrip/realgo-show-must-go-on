"use client";

// App-wide auth context. Loads the current user from the stored session on
// mount, exposes login/register/logout, and re-syncs when the token store
// changes (including from another tab).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import * as authApi from "./auth";
import { authChangedEvent, hasSession } from "./tokens";
import { ApiError } from "./types";
import type { AuthUser } from "./types";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  // Load (or clear) the session-backed user. Runs on mount and on auth changes.
  const sync = useCallback(async () => {
    if (!hasSession()) {
      setUser(null);
      setStatus("anonymous");
      return;
    }
    try {
      const me = await authApi.getMe();
      setUser(me);
      setStatus("authenticated");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setStatus("anonymous");
        return;
      }
      if (!hasSession()) {
        setUser(null);
        setStatus("anonymous");
        return;
      }
      setStatus((current) => (current === "authenticated" ? "authenticated" : "loading"));
    }
  }, []);

  useEffect(() => {
    void sync();
    const onChange = () => void sync();
    window.addEventListener(authChangedEvent, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(authChangedEvent, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [sync]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await authApi.login(email, password);
    setUser(u);
    setStatus("authenticated");
    return u;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const u = await authApi.register(email, password);
    setUser(u);
    setStatus("authenticated");
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Throws if used outside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
