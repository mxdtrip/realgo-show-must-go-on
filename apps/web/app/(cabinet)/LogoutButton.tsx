"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "../_api/AuthProvider";

export function LogoutButton({ label }: { label: string }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    await logout();
    router.push("/");
  }

  return (
    <button className="cabinet-topbar__link cabinet-logout" type="button" onClick={handleLogout} disabled={pending}>
      {pending ? "Выходим…" : label}
    </button>
  );
}
