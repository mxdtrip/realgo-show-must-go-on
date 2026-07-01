"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  useEffect(() => {
    if (!isLanding || shouldLoadVideo) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return undefined;

    const loadVideo = () => setShouldLoadVideo(true);
    const timerId = window.setTimeout(loadVideo, 1400);
    const listenerOptions = { passive: true };

    window.addEventListener("scroll", loadVideo, listenerOptions);
    window.addEventListener("pointerdown", loadVideo, listenerOptions);
    window.addEventListener("keydown", loadVideo);
    window.addEventListener("touchstart", loadVideo, listenerOptions);

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("scroll", loadVideo);
      window.removeEventListener("pointerdown", loadVideo);
      window.removeEventListener("keydown", loadVideo);
      window.removeEventListener("touchstart", loadVideo);
    };
  }, [isLanding, shouldLoadVideo]);

  useEffect(() => {
    if (!isLanding || !shouldLoadVideo) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let duration = 0;
    let target = START_TIME;
    let current = START_TIME;
    let lastSet = -1;
    let ready = false;
    let rafId = 0;

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
      if (!ready || !Number.isFinite(time)) return;
      if (Math.abs(time - lastSet) < 0.0005) return;
      lastSet = time;
      try {
        video.currentTime = time;
      } catch {
        // ignore seeks while metadata is still settling
      }
    };

    const tick = () => {
      current += (target - current) * SMOOTHING;
      if (Math.abs(target - current) < 0.001) current = target;
      seek(current);
      rafId = requestAnimationFrame(tick);
    };

    const onLoaded = () => {
      duration = Number.isFinite(video.duration) ? video.duration : START_TIME;
      ready = true;
      computeTarget();
      current = target;
      seek(current);
    };

    // Some browsers (notably iOS Safari) won't paint a paused video until it has
    // played once; a muted play/pause primes the decoder so seeking shows frames.
    const prime = () => {
      video.play().then(() => video.pause()).catch(() => {});
    };

    if (video.readyState >= 1) onLoaded();
    else video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("loadeddata", prime, { once: true });
    video.load();

    if (reduceMotion) {
      return () => {
        video.removeEventListener("loadedmetadata", onLoaded);
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
    };
  }, [isLanding, shouldLoadVideo]);

  if (!isLanding) {
    return null;
  }

  return (
    <div className="scroll-video-bg" aria-hidden="true">
      {shouldLoadVideo ? (
        <video ref={videoRef} src="/engram-hero.mp4" muted playsInline preload="none" tabIndex={-1} />
      ) : null}
      <div className="scroll-video-bg__overlay" />
    </div>
  );
}
