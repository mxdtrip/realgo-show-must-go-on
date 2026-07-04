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
 *
 * Reveal and hide use two observers with different boundaries (hysteresis).
 * A single boundary self-oscillates: revealing shifts the element by its own
 * transform (up to 32px), which can carry it back across the very line that
 * triggered it, toggling the state forever — on phones this read as a card
 * trembling up and down when the scroll stopped near the trigger line. With
 * a hide line ~12% of the viewport shy of the reveal line, the state only
 * flips after travelling farther than any reveal transform can move it.
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
    const apply = (el: HTMLElement, shouldReveal: boolean) => {
      if (el.classList.contains("is-revealed") === shouldReveal) {
        return;
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
    };

    // Both edges are pulled in by the same amount so the trigger line is
    // symmetric: entrances wait until a section is a beat deeper into
    // view, and exits fire once it's a matching beat past the opposite
    // edge — instead of needing to fully clear the real viewport edge,
    // which reads as "it never disappears" when scrolling down past it.
    // The reveal observer only ever reveals; hiding is the hide observer's
    // job, whose boundary sits closer to the real edge. The ~12% gap between
    // the two lines is the hysteresis band — it must stay comfortably larger
    // than the biggest reveal transform (32px, see globals.css), which is
    // what a state flip shifts the element by.
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) apply(entry.target as HTMLElement, true);
        }
      },
      { rootMargin: "-18% 0px -18% 0px", threshold: 0.1 },
    );
    const hideObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) apply(entry.target as HTMLElement, false);
        }
      },
      { rootMargin: "-6% 0px -6% 0px", threshold: 0 },
    );

    for (const el of elements) {
      revealObserver.observe(el);
      hideObserver.observe(el);
    }

    return () => {
      revealObserver.disconnect();
      hideObserver.disconnect();
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      root.classList.remove("reveal-ready");
    };
  }, []);

  return null;
}
