import type { Platform } from "../lib/types";
import { leetcodeAdapter } from "./leetcode";
import { neetcodeAdapter } from "./neetcode";
import type { PlatformAdapter } from "./types";

export type { PlatformAdapter, TaskInfo } from "./types";

/** All known adapters, in match priority order. NeetCode first (MVP target). */
export const adapters: PlatformAdapter[] = [neetcodeAdapter, leetcodeAdapter];

/** Returns the adapter for the given URL, or null when no platform matches. */
export function detectAdapter(url: string = location.href): PlatformAdapter | null {
  return adapters.find((a) => a.matches(url)) ?? null;
}

/** Convenience: resolves just the platform code for the given URL. */
export function detectPlatform(url: string = location.href): Platform {
  return detectAdapter(url)?.platform ?? "unknown";
}
