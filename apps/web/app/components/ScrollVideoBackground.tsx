"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Background clip @ 120fps. At the top of the page the video sits at START_TIME;
// scrolling scrubs it forward (down) / backward (up). The scrub range is mapped
// onto [page top → bottom of the #memory section], so the clip reaches its last
// frame exactly when that section has been fully scrolled through, then holds.
const START_TIME = 0;
// Section whose bottom edge marks the end of the clip.
const SCRUB_END_SECTION_ID = "memory";
// Per-frame easing toward the scroll target: higher = snappier, lower = smoother.
const SMOOTHING = 0.12;

export function ScrollVideoBackground() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!isLanding) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let duration = 0;
    let target = START_TIME;
    let current = START_TIME;
    let ready = false;
    let rafId = 0;
    // While the page settles after (re)load, we lock the frame straight onto
    // the live scroll position instead of easing toward it (see `tick`).
    let settleUntil = 0;
    // True between issuing `video.currentTime = …` and the resulting `seeked`.
    // A high-res clip can't decode a new frame every animation frame, so firing
    // a fresh seek each tick just queues work the decoder drops — the video then
    // visibly lags behind the scroll. We instead hold off until the in-flight
    // seek finishes, always seeking to the *latest* target when it does.
    let seeking = false;
    // When the in-flight seek was issued. If `seeked` never fires — e.g. the seek
    // is cancelled by the `video.load()` below when a deep reload restores the
    // scroll offset — the flag would stay stuck and freeze the clip on frame 0.
    // A watchdog clears it after SEEK_TIMEOUT_MS so the next tick retries. Normal
    // scrub seeks resolve well under this, so throttling to the decoder's rate
    // (the reason the flag exists) still holds.
    let seekStartedAt = 0;
    const SEEK_TIMEOUT_MS = 250;

    const computeTarget = () => {
      // Scroll distance over which the clip should play: from the top of the page
      // until the bottom of the anchor section reaches the bottom of the viewport.
      const section = document.getElementById(SCRUB_END_SECTION_ID);
      let endScroll: number;
      if (section) {
        const sectionBottom = section.getBoundingClientRect().bottom + window.scrollY;
        endScroll = sectionBottom - window.innerHeight;
      } else {
        endScroll = document.documentElement.scrollHeight - window.innerHeight;
      }
      endScroll = Math.max(1, endScroll);
      const progress = Math.min(1, Math.max(0, window.scrollY / endScroll));
      const end = Math.max(START_TIME, duration);
      target = START_TIME + progress * (end - START_TIME);
    };

    const seek = (time: number) => {
      // Skip while a previous seek is still in flight; the next tick re-issues
      // with the newest target once `seeked` clears the flag. This throttles
      // seeks to the decoder's real rate instead of flooding it every frame.
      if (!ready || seeking || !Number.isFinite(time)) return;
      // Compare against the video's ACTUAL position, not the last requested
      // value. A seek issued while the element is still (re)loading — e.g. right
      // after a reload that restored the scroll deep down the page, where the
      // effect's `video.load()` resets currentTime back to 0 — is silently
      // dropped. Guarding on the last requested value would then never retry and
      // the clip freezes on frame 0; re-issuing until the element truly reaches
      // the target self-heals once it becomes seekable.
      if (Math.abs(time - video.currentTime) < 0.005) return;
      try {
        seeking = true;
        seekStartedAt = performance.now();
        video.currentTime = time;
      } catch {
        // ignore seeks while metadata is still settling
        seeking = false;
      }
    };

    const tick = () => {
      // Self-heal a seek whose `seeked` never arrived (cancelled by a reload's
      // load()), so the flag can't stay stuck and freeze the clip.
      if (seeking && performance.now() - seekStartedAt > SEEK_TIMEOUT_MS) {
        seeking = false;
      }
      if (ready) {
        // Recompute the target from the live scroll position every frame. The
        // browser restores the scroll offset a beat AFTER the video metadata
        // loads, and that restoration doesn't reliably fire a scroll event —
        // tracking scroll here (rather than only on scroll events) means a deep
        // reload always lands on the matching frame instead of freezing on
        // frame 0. Right after (re)load we snap straight to it; once the page
        // has settled we ease toward it for smooth scrubbing.
        computeTarget();
        if (performance.now() < settleUntil) {
          current = target;
        } else {
          current += (target - current) * SMOOTHING;
          if (Math.abs(target - current) < 0.001) current = target;
        }
        seek(current);
      }
      rafId = requestAnimationFrame(tick);
    };

    const onLoaded = () => {
      duration = Number.isFinite(video.duration) ? video.duration : START_TIME;
      ready = true;
      computeTarget();
      current = target;
      seek(current);
      // Keep snapping to the restored scroll position for a short beat, so a
      // deep reload lands on the matching frame instead of freezing on frame 0.
      settleUntil = performance.now() + 1200;
    };

    // Clear the in-flight flag once the decoder has produced the target frame
    // (or bailed), so the next tick can seek to the newest scroll position.
    const onSeeked = () => {
      seeking = false;
    };

    // Some browsers (notably iOS Safari) won't paint a paused video until it has
    // played once; a muted play/pause primes the decoder so seeking shows frames.
    const prime = () => {
      video.play().then(() => video.pause()).catch(() => {});
    };

    if (video.readyState >= 1) onLoaded();
    else video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("loadeddata", prime, { once: true });
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onSeeked);
    video.load();

    if (reduceMotion) {
      // No scrubbing loop under reduced motion, but still lock onto the
      // restored scroll position for a short beat after load (same race as in
      // `tick`), so a deep reload lands on the matching frame, not frame 0.
      const settleEnd = performance.now() + 2000;
      let settleRaf = 0;
      const settle = () => {
        if (seeking && performance.now() - seekStartedAt > SEEK_TIMEOUT_MS) {
          seeking = false;
        }
        if (ready) {
          computeTarget();
          current = target;
          seek(current);
        }
        if (performance.now() < settleEnd) settleRaf = requestAnimationFrame(settle);
      };
      settleRaf = requestAnimationFrame(settle);
      return () => {
        cancelAnimationFrame(settleRaf);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onSeeked);
      };
    }

    const onScroll = () => computeTarget();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onSeeked);
    };
  }, [isLanding]);

  if (!isLanding) {
    return null;
  }

  return (
    <div className="scroll-video-bg" aria-hidden="true">
      <video ref={videoRef} src="/realgo-hero.mp4" muted playsInline preload="auto" tabIndex={-1} />
      <div className="scroll-video-bg__overlay" />
    </div>
  );
}
