"use client";

import { useEffect, useRef } from "react";

// Background clip is ~4s @ 120fps. When the page is at the very top the video
// sits at START_TIME; scrolling maps the whole page onto [START_TIME, duration]
// and scrubs the frame forward (down) / backward (up).
const START_TIME = 2;
// Per-frame easing toward the scroll target: higher = snappier, lower = smoother.
const SMOOTHING = 0.12;

export function ScrollVideoBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
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
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
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
  }, []);

  return (
    <div className="scroll-video-bg" aria-hidden="true">
      <video ref={videoRef} src="/engram-hero.mp4" muted playsInline preload="auto" tabIndex={-1} />
      <div className="scroll-video-bg__overlay" />
    </div>
  );
}
