"use client";

// Практика подпаттернов: личный набор «активных» узлов, по которым гоняется
// карточная practice-сессия и строится страница прогресса.

import { apiFetch } from "./client";

export type PracticeSubpattern = {
  code: string;
  name: string;
  addedAt: string;
};

export function getPractice(signal?: AbortSignal) {
  return apiFetch<{ subpatterns: PracticeSubpattern[] }>("/me/practice", { signal });
}

export function addPracticeSubpattern(code: string) {
  return apiFetch<{ code: string; active: boolean }>("/me/practice/subpatterns", {
    method: "POST",
    body: { code },
  });
}

export function removePracticeSubpattern(code: string) {
  return apiFetch<void>(`/me/practice/subpatterns/${encodeURIComponent(code)}`, {
    method: "DELETE",
  });
}
