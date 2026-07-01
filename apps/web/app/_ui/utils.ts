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
