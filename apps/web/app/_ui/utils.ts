import type { CSSProperties } from "react";

export type UITone = "default" | "accent" | "success" | "warning" | "danger";
export type CSSLength = number | string;
export type CSSVariableStyle = CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function cssLength(value: CSSLength | undefined) {
  if (typeof value === "number") return `${value}px`;
  return value;
}

/** "arrays_hashing" -> "Arrays Hashing". Used for <title> on pattern routes,
    where the real display name only exists behind a live Atlas fetch. */
export function titleFromPatternCode(code: string): string {
  return code
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
