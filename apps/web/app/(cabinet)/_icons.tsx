import type { ReactElement, SVGProps } from "react";

/**
 * Inline, dependency-free icon set for the cabinet.
 * Stroke-based, 24x24 viewBox, inherits `currentColor` so callers tint via CSS.
 * Kept deliberately small and uniform (1.6 stroke) to read as a single family.
 */
const GLYPHS: Record<string, ReactElement> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </>
  ),
  reviews: (
    <>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 4v4h-4" />
    </>
  ),
  problems: (
    <>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  cards: (
    <>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </>
  ),
  roadmap: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <line x1="8" y1="2.5" x2="8" y2="6" />
      <line x1="16" y1="2.5" x2="16" y2="6" />
    </>
  ),
  patterns: (
    <>
      <path d="M3 12h3.5l2.5-7 4 15 2.5-8H21" />
    </>
  ),
  extension: (
    <>
      <path d="M9 2v5.2" />
      <path d="M15 2v5.2" />
      <path d="M6 7.2h12v3.3a6 6 0 0 1-12 0V7.2Z" />
      <path d="M12 16.5V22" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.6v3M12 18.4v3M3.1 12h3M17.9 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" />
    </>
  ),
  queue: (
    <>
      <path d="M22 12h-5.5l-1.5 2.5h-6L7.5 12H2" />
      <path d="M5.5 6 2 12v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5l-3.5-6a2 2 0 0 0-1.8-1H7.3a2 2 0 0 0-1.8 1Z" />
    </>
  ),
  readiness: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  weak: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <line x1="12" y1="9" x2="12" y2="13.5" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  streak: (
    <>
      <path d="M12 2.5c2.2 3.7 6 6 6 10.5a6 6 0 0 1-12 0c0-2 .8-3.6 2-5 .4 2 2 2.6 2 2.6-.6-4 1-7.4 0-8.1Z" />
    </>
  ),
  selector: (
    <>
      <path d="m8 9 4-4 4 4" />
      <path d="m16 15-4 4-4-4" />
    </>
  ),
  arrow: (
    <>
      <line x1="4" y1="12" x2="19" y2="12" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
};

export function CabinetIcon({
  name,
  ...props
}: Readonly<{ name: string } & SVGProps<SVGSVGElement>>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {GLYPHS[name] ?? null}
    </svg>
  );
}
