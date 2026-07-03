"use client";

import { useEffect } from "react";

// Keep in sync with the `landing scroll reveal` block in globals.css.
const REVEAL_DURATION_MS = 750;
const REVEAL_CLEANUP_BUFFER_MS = 250;

/**
 * Progressive scroll-in/out animations for the landing page.
 *
 * Server markup stays untouched except for `data-reveal` attributes; the
 * hidden state only kicks in once this component adds `reveal-ready` to
 * <html>, so content is fully visible without JS (and with reduced motion).
 * Elements are observed for their whole lifetime (never unobserved) and
 * `is-revealed` toggles both ways, so a section flies out again once it's
 * scrolled past and replays the entrance if the user scrolls back. The
 * transition itself only runs while `is-animating` is present, which is
 * added right before the toggle and removed after the duration elapses —
 * that keeps a card's own hover transition untouched between crossings.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (elements.length === 0) {
      return;
    }

    const root = document.documentElement;
    root.classList.add("reveal-ready");

    const timers = new Map<HTMLElement, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const shouldReveal = entry.isIntersecting;
          if (el.classList.contains("is-revealed") === shouldReveal) {
            continue;
          }

          const existingTimer = timers.get(el);
          if (existingTimer) {
            window.clearTimeout(existingTimer);
          }

          const delay = Number(el.dataset.revealDelay) || 0;
          el.style.transitionDelay = delay > 0 ? `${delay}ms` : "";
          el.classList.add("is-animating");
          el.classList.toggle("is-revealed", shouldReveal);

          const timer = window.setTimeout(() => {
            timers.delete(el);
            el.classList.remove("is-animating");
            el.style.transitionDelay = "";
          }, REVEAL_DURATION_MS + delay + REVEAL_CLEANUP_BUFFER_MS);
          timers.set(el, timer);
        }
      },
      // Both edges are pulled in by the same amount so the trigger line is
      // symmetric: entrances wait until a section is a beat deeper into
      // view, and exits fire once it's a matching beat past the opposite
      // edge — instead of needing to fully clear the real viewport edge,
      // which reads as "it never disappears" when scrolling down past it.
      { rootMargin: "-18% 0px -18% 0px", threshold: 0.1 },
    );

    for (const el of elements) {
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      root.classList.remove("reveal-ready");
    };
  }, []);

  return null;
}
