import type { SubmitResult } from "../lib/types";
import {
  classifyVerdict,
  findButtonByText,
  findText,
  type PlatformAdapter,
  type TaskInfo,
} from "./types";

/**
 * LeetCode adapter (stub).
 *
 * Laid out through the same interface so LeetCode support is a fill-in job, but
 * NeetCode is the MVP focus — do not over-invest here yet.
 */
export const leetcodeAdapter: PlatformAdapter = {
  platform: "leetcode",

  matches(url: string): boolean {
    try {
      return new URL(url).hostname.endsWith("leetcode.com") && url.includes("/problems/");
    } catch {
      return false;
    }
  },

  extractTaskInfo(): TaskInfo | null {
    const slug = slugFromPath(location.pathname);
    if (!slug) return null;
    const title =
      findText(["[data-cy='question-title']", "h1", "a[href*='/problems/']"]) ||
      document.title.replace(/\s*-\s*LeetCode.*$/i, "").trim();
    return {
      taskTitle: cleanTitle(title),
      taskUrl: location.href,
      platformTaskSlug: slug,
      tags: extractTags(),
      difficulty: extractDifficulty(),
    };
  },

  findSubmitButton(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>("[data-e2e-locator='console-submit-button']") ||
      findButtonByText((t) => t === "submit")
    );
  },

  detectSubmitResult(): SubmitResult {
    const text = findText([
      "[data-e2e-locator='submission-result']",
      "[data-e2e-locator='submission-result-text']",
      "[data-cy='submission-result']",
      "[class*='result']",
      "[class*='verdict']",
    ]);
    return classifyVerdict(text);
  },
};

function slugFromPath(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("problems");
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  return undefined;
}

function cleanTitle(title: string): string {
  return title.replace(/^\s*\d+\.\s*/, "").trim();
}

function extractDifficulty(): string | undefined {
  const text = findText([
    "[diff]",
    "[data-difficulty]",
    "div[class*='text-difficulty']",
    "div[class*='difficulty']",
  ]).toLowerCase();
  if (text.includes("easy")) return "easy";
  if (text.includes("medium")) return "medium";
  if (text.includes("hard")) return "hard";
  return undefined;
}

function extractTags(): string[] {
  const nodes = document.querySelectorAll<HTMLElement>(
    "a[href*='/tag/'], a[href*='/problem-list/'], [class*='topic'] a, [class*='tag'] a, [class*='topic'] span"
  );
  const seen = new Set<string>();
  for (const el of nodes) {
    const raw = (el.textContent ?? "").trim();
    const tag = raw.toLowerCase();
    if (!tag || tag.length > 28 || tag.includes("\n")) continue;
    if (tag === "easy" || tag === "medium" || tag === "hard") continue;
    seen.add(tag);
    if (seen.size >= 6) break;
  }
  return [...seen];
}
