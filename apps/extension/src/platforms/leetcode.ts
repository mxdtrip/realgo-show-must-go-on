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
    return { taskTitle: title, taskUrl: location.href, platformTaskSlug: slug };
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
      "[class*='result']",
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
