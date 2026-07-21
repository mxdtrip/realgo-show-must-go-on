import type { SubmitResult } from "../lib/types";
import { classifyVerdict, extractDescription, findText, type PlatformAdapter, type TaskInfo } from "./types";

/**
 * Codeforces adapter.
 *
 * Architecturally different from the other three: LeetCode, HackerRank and
 * GeeksforGeeks all run an in-page editor where submit and verdict resolve
 * without leaving the problem page. Codeforces does not — its problem pages
 * (/contest/<id>/problem/<index>, /problemset/problem/<id>/<index>,
 * /gym/<id>/problem/<index>) only carry a "Submit" link that navigates to a
 * separate submit form, which itself redirects to a status/"My submissions"
 * page where the verdict then appears and updates in place while judging.
 *
 * This adapter only recognises the problem page (where extractTaskInfo has
 * real content to read). The click handler in contents/realgo.ts detects
 * `crossPage` on the adapter and, instead of watching in place, persists the
 * click-time snapshot (see lib/storage.ts cross-page intent helpers) so it
 * survives the navigation; `crossPage.isResultPage` then tells the content
 * script which later page to resume watching on.
 */
export const codeforcesAdapter: PlatformAdapter = {
  platform: "codeforces",

  matches(url: string): boolean {
    try {
      const u = new URL(url);
      return u.hostname.endsWith("codeforces.com") && u.pathname.includes("/problem/");
    } catch {
      return false;
    }
  },

  extractTaskInfo(): TaskInfo | null {
    const slug = slugFromPath(location.pathname);
    if (!slug) return null;

    const title =
      findText([".problem-statement .title", "[class*='title']"]) ||
      cleanDocTitle() ||
      slug;

    return {
      taskTitle: cleanTitle(title),
      taskUrl: location.href,
      platformTaskSlug: slug,
      tags: extractTags(),
      difficulty: extractRating(),
      taskDescription: extractDescription([".problem-statement", "[class*='problem-statement']"]),
    };
  },

  findSubmitButton(): HTMLElement | null {
    // The submit control here is a link to a separate submit form, not a
    // button — href-based matching also sidesteps Codeforces' UI language
    // switcher (English/Russian), where a text match like "submit" would miss
    // "Отправить".
    return (
      document.querySelector<HTMLElement>("a[href*='/submit']") ||
      findLinkByText((text) => text === "submit" || text === "отправить")
    );
  },

  // Only meaningful when called on a resumed result page (see crossPage
  // below) — the problem page itself never shows a verdict.
  detectSubmitResult(): SubmitResult {
    const rows = document.querySelectorAll<HTMLElement>(
      "table[class*='status'] tr, [class*='status-frame'] tr"
    );
    for (const row of rows) {
      if (!row.querySelector("td")) continue; // header row, no submission data
      const cell = row.querySelector<HTMLElement>("[class*='verdict']") ?? row;
      const text = (cell.textContent ?? "").trim();
      // Only the newest (topmost) submission row is ever relevant — an older
      // row for a different problem could otherwise read as a false verdict.
      return text ? classifyVerdict(text) : "unknown";
    }
    return "unknown";
  },

  crossPage: {
    isResultPage(url: string): boolean {
      try {
        const u = new URL(url);
        if (!u.hostname.endsWith("codeforces.com")) return false;
        return /\/(status|my|submission)/.test(u.pathname);
      } catch {
        return false;
      }
    },
  },
};

function slugFromPath(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const problemIdx = parts.indexOf("problem");
  if (problemIdx < 1) return undefined;
  const index = parts[problemIdx + 1];
  if (!index) return undefined;
  const contestId = parts[problemIdx - 1];
  // Gym problems reuse the same numeric id space as regular contests —
  // prefixing avoids two unrelated problems colliding on the same slug.
  const prefix = parts.includes("gym") ? "gym" : "";
  return `${prefix}${contestId}${index}`.toLowerCase();
}

function cleanTitle(title: string): string {
  return title.replace(/^\s*[A-Z][0-9]?\.\s*/, "").trim() || title.trim();
}

function cleanDocTitle(): string {
  return document.title.replace(/\s*-\s*Codeforces.*$/i, "").trim();
}

/** First `<a>` whose visible text matches the predicate (see findSubmitButton
    for why this adapter needs links, unlike the shared findButtonByText). */
function findLinkByText(match: (text: string) => boolean): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>("a");
  for (const el of candidates) {
    const text = (el.textContent ?? "").trim().toLowerCase();
    if (text && match(text)) return el;
  }
  return null;
}

/**
 * Best-effort topic tags. Codeforces lists them in a sidebar "tag-box" block,
 * which also includes the numeric difficulty rating (e.g. "*1700") — that one
 * is filtered out here and surfaced separately via extractRating instead.
 */
function extractTags(): string[] {
  const nodes = document.querySelectorAll<HTMLElement>(".tag-box, [class*='tag-box']");
  const seen = new Set<string>();
  for (const el of nodes) {
    const t = (el.textContent ?? "").trim().toLowerCase();
    if (t && !t.startsWith("*") && t.length <= 28 && !t.includes("\n")) seen.add(t);
    if (seen.size >= 6) break;
  }
  return [...seen];
}

/**
 * Codeforces has no easy/medium/hard scale — problems carry a numeric
 * difficulty rating instead (e.g. "1700"). Surfaced as-is rather than forced
 * into the three-tier scale; the backend already drops unrecognised
 * difficulty values rather than rejecting the submission over it.
 */
function extractRating(): string | undefined {
  const nodes = document.querySelectorAll<HTMLElement>(".tag-box, [class*='tag-box']");
  for (const el of nodes) {
    const t = (el.textContent ?? "").trim();
    if (/^\*\d+$/.test(t)) return t.slice(1);
  }
  return undefined;
}
