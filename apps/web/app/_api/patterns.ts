"use client";

import { apiFetch } from "./client";

export type PatternExampleProblem = {
  title: string;
  difficulty: string;
  url: string;
};

export type PatternDetail = {
  code: string;
  name: string;
  description: string;
  techniques: string[];
  recognitionSymptoms: string[];
  checklist: string[];
  exampleProblems: PatternExampleProblem[];
};

export function getPatternDetail(code: string, signal?: AbortSignal) {
  return apiFetch<PatternDetail>(`/me/patterns/${encodeURIComponent(code)}`, { signal });
}
