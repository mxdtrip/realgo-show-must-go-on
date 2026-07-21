import type { Platform, SubmitResult } from "../lib/types";

export interface TaskInfo {
  taskTitle: string;
  taskUrl: string;
  platformTaskSlug?: string;
  /** Topic tags read from the page, best-effort (empty/absent if none found). */
  tags?: string[];
  /** Difficulty read from the page, best-effort. */
  difficulty?: string;
  /** Problem statement text read from the page, best-effort (absent if not found). */
  taskDescription?: string;
}

/** Caps how much page text rides along in the AI prompt (backend re-caps too). */
const MAX_DESCRIPTION_CHARS = 4000;

/**
 * Best-effort problem statement scrape: tries each selector in order and
 * returns the first non-empty `innerText`, trimmed and capped. Both LeetCode
 * and HackerRank ship no stable data-* hook for the statement body, so this
 * degrades to `undefined` rather than guessing wrong.
 */
export function extractDescription(selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    const text = el?.innerText?.trim();
    if (text) {
      return text.length > MAX_DESCRIPTION_CHARS
        ? text.slice(0, MAX_DESCRIPTION_CHARS) + "…"
        : text;
    }
  }
  return undefined;
}

/**
 * A PlatformAdapter encapsulates everything platform-specific:
 * recognising the page, reading the task, finding the Submit control and
 * reading the verdict after a submit.
 *
 * Adapters must be defensive: the DOM of a third-party site can change at any
 * time, so every method returns a safe fallback instead of throwing.
 */
export interface PlatformAdapter {
  readonly platform: Platform;

  /** True when this adapter handles the given location. */
  matches(url: string): boolean;

  /** Reads the current task, or null if the page is not a task page. */
  extractTaskInfo(): TaskInfo | null;

  /** Locates the Submit button to watch, if present. */
  findSubmitButton(): HTMLElement | null;

  /**
   * Inspects the DOM for a verdict. Called repeatedly by a MutationObserver
   * after a submit; returns "unknown" until a verdict is recognised.
   */
  detectSubmitResult(): SubmitResult;

  /**
   * Present only for platforms whose submit control navigates to a different
   * page before a verdict appears (Codeforces: the problem page's Submit link
   * opens a separate submit form, and the verdict then appears on a
   * submissions/status page) — same-page platforms (LeetCode, HackerRank,
   * GeeksforGeeks) omit this and are watched in place instead. When present,
   * the content script persists the click-time task snapshot across the
   * navigation and resumes watching once `isResultPage` matches.
   */
  crossPage?: {
    /** True on a page where a previously persisted submit intent for this
        platform should resume being watched for a verdict. */
    isResultPage(url: string): boolean;
  };
}

/**
 * Maps free verdict text found in the DOM to a normalized SubmitResult.
 * Covers LeetCode ("Accepted", "Wrong Answer"), HackerRank ("All test cases
 * passed", "Terminated due to timeout", "Compilation error"), GeeksforGeeks
 * ("Correct Answer") and Codeforces ("Accepted", "Wrong answer on test N",
 * "Memory limit exceeded on test N", "Idleness limit exceeded") wording — none
 * of these phrasings overlap, so one classifier safely serves every adapter.
 */
export function classifyVerdict(text: string): SubmitResult {
  const t = text.toLowerCase();
  if (t.includes("all test cases passed")) return "accepted";
  if (t.includes("correct answer")) return "accepted";
  if (/\baccepted\b/.test(t) && !/\bacceptance\b/.test(t)) return "accepted";
  if (t.includes("wrong answer")) return "wrong_answer";
  if (t.includes("compilation error") || t.includes("compile error")) return "runtime_error";
  if (t.includes("runtime error")) return "runtime_error";
  // Memory limit exceeded has no dedicated bucket; grouped with the other
  // "submission failed for a resource reason, not a wrong answer" verdicts.
  if (t.includes("memory limit")) return "runtime_error";
  if (t.includes("terminated due to timeout") || t.includes("time limit")) return "time_limit";
  // Codeforces-specific: judge gave up waiting on an interactive/IO problem.
  if (t.includes("idleness limit")) return "time_limit";
  return "unknown";
}

/** Lowercased text content of the first element matching any selector. */
export function findText(selectors: string[]): string {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent) return el.textContent.trim();
  }
  return "";
}

/** First clickable element whose visible text matches the predicate. Plain
    `<a>` links are deliberately excluded: a real code-submit control is a
    button (or ARIA button), and including links widened the search to any
    matching nav/footer/marketing link anywhere on the page. */
export function findButtonByText(match: (text: string) => boolean): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>("button, [role='button']");
  for (const el of candidates) {
    const text = (el.textContent ?? "").trim().toLowerCase();
    if (text && match(text)) return el;
  }
  return null;
}

/** A short label starting with "submit" — "Submit", "Submit Code", "Submit
    Solution" — as opposed to an unrelated "Submit application"/"Submit your
    feedback" button that merely happens to start with the same word (a real
    risk: this is a page-wide search, not scoped to the code editor, and a
    platform page can embed unrelated forms — job listings, feedback widgets
    — alongside the problem). */
export function looksLikeSubmitLabel(text: string): boolean {
  return text === "submit" || (text.startsWith("submit") && text.length <= 16);
}
