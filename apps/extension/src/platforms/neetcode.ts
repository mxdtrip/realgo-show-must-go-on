import type { SubmitResult } from "../lib/types";
import {
  classifyVerdict,
  findButtonByText,
  findText,
  type PlatformAdapter,
  type TaskInfo,
} from "./types";

/**
 * NeetCode adapter (MVP target).
 *
 * Problem pages live at https://neetcode.io/problems/<slug>. NeetCode embeds
 * the LeetCode-style problem; the slug usually matches the LeetCode slug, which
 * is exactly what the seeded `problems` rows use, so the backend can resolve it.
 *
 * The DOM selectors below are best-effort. NeetCode is a SPA and ships no stable
 * data-* hooks, so detection degrades gracefully to "unknown" rather than break.
 */
export const neetcodeAdapter: PlatformAdapter = {
  platform: "neetcode",

  matches(url: string): boolean {
    try {
      const u = new URL(url);
      return u.hostname.endsWith("neetcode.io") && u.pathname.includes("/problems/");
    } catch {
      return false;
    }
  },

  extractTaskInfo(): TaskInfo | null {
    const slug = slugFromPath(location.pathname);
    if (!slug) return null;

    const title =
      findText(["h1", "[class*='problem'] h1", "[class*='title']"]) ||
      slugToTitle(slug) ||
      cleanDocTitle();

    return {
      taskTitle: title,
      taskUrl: location.href,
      platformTaskSlug: slug,
      tags: extractTags(),
      difficulty: extractDifficulty(),
    };
  },

  findSubmitButton(): HTMLElement | null {
    return findButtonByText((t) => t === "submit" || t.startsWith("submit"));
  },

  detectSubmitResult(): SubmitResult {
    // NeetCode surfaces the verdict near the editor/console once a run resolves.
    const text = findText([
      "[class*='result']",
      "[class*='verdict']",
      "[class*='status']",
      "[class*='console']",
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

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function cleanDocTitle(): string {
  return document.title.replace(/\s*[-|]\s*NeetCode.*$/i, "").trim();
}

/**
 * Best-effort topic tags (e.g. "arrays", "two pointers"). NeetCode exposes no
 * stable hooks, so we scan likely "topic/tag/category" containers and keep a few
 * short, sane labels. Returns [] when nothing trustworthy is found — the popup
 * simply renders no tags rather than guessing wrong.
 */
function extractTags(): string[] {
  const nodes = document.querySelectorAll<HTMLElement>(
    "[class*='topic'] a, [class*='topic'] span, [class*='tag'] a, [class*='category'] a"
  );
  const seen = new Set<string>();
  for (const el of nodes) {
    const t = (el.textContent ?? "").trim().toLowerCase();
    if (t && t.length <= 24 && !t.includes("\n")) seen.add(t);
    if (seen.size >= 4) break;
  }
  return [...seen];
}

function extractDifficulty(): string | undefined {
  const text = findText([
    "[class*='difficulty']",
    "[class*='badge']",
    "[class*='tag']",
  ]).toLowerCase();
  if (text.includes("easy")) return "easy";
  if (text.includes("medium")) return "medium";
  if (text.includes("hard")) return "hard";
  return undefined;
}
