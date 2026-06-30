import type { Platform, SubmitResult } from "../lib/types";

export interface TaskInfo {
  taskTitle: string;
  taskUrl: string;
  platformTaskSlug?: string;
  /** Topic tags read from the page, best-effort (empty if none found). */
  tags?: string[];
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
}

/** Maps free verdict text found in the DOM to a normalized SubmitResult. */
export function classifyVerdict(text: string): SubmitResult {
  const t = text.toLowerCase();
  if (t.includes("accepted")) return "accepted";
  if (t.includes("wrong answer")) return "wrong_answer";
  if (t.includes("runtime error")) return "runtime_error";
  if (t.includes("time limit")) return "time_limit";
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

/** First clickable element whose visible text matches the predicate. */
export function findButtonByText(match: (text: string) => boolean): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    "button, [role='button'], a"
  );
  for (const el of candidates) {
    const text = (el.textContent ?? "").trim().toLowerCase();
    if (text && match(text)) return el;
  }
  return null;
}
