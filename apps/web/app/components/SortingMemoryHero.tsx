"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getDictionary } from "../_content/i18n";

const WORD = "engram";
const LETTER_COUNT = WORD.length;

// Per-glyph advance widths (relative to the font size) so the letters lay out
// with even gaps instead of equal-width slots. Bootstrapped from Inter 700
// metrics for a deterministic first paint, then refined from the real loaded
// font via canvas (see the measure effect below).
const FALLBACK_RATIOS = [0.57, 0.62, 0.62, 0.4, 0.57, 0.91]; // e n g r a m
let glyphRatios: number[] | null = null;

function measureGlyphRatios(): number[] | null {
  if (typeof document === "undefined") return null;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  const family = getComputedStyle(document.body).fontFamily || "Inter, system-ui, sans-serif";
  ctx.font = `700 1000px ${family}`;
  return [...WORD].map((char) => ctx.measureText(char).width / 1000);
}
const GATHER_MS = 980;
const COMPARE_MS = 90;
const SWAP_MS = 430;
const SWAP_PAUSE_MS = 45;
const DEFAULT_CODE = `function bubbleSort(a) {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a.length - i - 1; j++) {
      if (compare(j, j + 1) > 0) {
        swap(j, j + 1);
      }
    }
  }
}`;

type Pose = {
  key: number;
  x: number;
  y: number;
  rotate: number;
  visible: boolean;
};

type MotionMode = "idle" | "gathering" | "swapping";

type SortStep = {
  type: "compare" | "swap";
  a: number;
  b: number;
};

type SceneSize = {
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function shuffle(order: number[]) {
  const next = [...order];

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  if (next.every((item, index) => item === index)) {
    [next[0], next[1]] = [next[1], next[0]];
  }

  return next;
}

function geometry(size: SceneSize) {
  const font = clamp(Math.floor(size.width / 8.2), 54, 132);
  // Even gap between glyphs; widths come from real per-letter metrics.
  const gap = clamp(font * 0.1, 7, 14);
  const ratios = glyphRatios ?? FALLBACK_RATIOS;
  const widths = ratios.map((ratio) => ratio * font);
  const total = widths.reduce((sum, w) => sum + w, 0) + (LETTER_COUNT - 1) * gap;

  return {
    font,
    gap,
    widths,
    startX: (size.width - total) / 2,
    // Sit the word above the vertical centre (0.5 = middle, lower = higher).
    y: size.height * 0.4 - font * 0.56,
  };
}

function rowPoses(size: SceneSize, order: number[]) {
  const g = geometry(size);
  let x = g.startX;

  // Advance by each letter's own width, so the visible gap between every pair
  // of glyphs is exactly `gap` — no more wide voids around narrow letters.
  return order.map((key) => {
    const pose = { key, x, y: g.y, rotate: 0, visible: true };
    x += g.widths[key] + g.gap;
    return pose;
  });
}

// Scatter the letters onto random points of an invisible, width-stretched oval
// centred on the word, with a small ±jitter along the radius so the ring of
// letters looks organic rather than perfectly geometric.
const CHAOS_JITTER = 50;

function chaosPoses(size: SceneSize, order: number[]) {
  const g = geometry(size);
  const centerX = size.width / 2;
  const centerY = size.height * 0.4;
  const radiusX = size.width * 0.42;
  const radiusY = size.height * 0.32;

  return order.map((key, index) => {
    const angle = Math.random() * Math.PI * 2;
    const ex = radiusX * Math.cos(angle);
    const ey = radiusY * Math.sin(angle);
    const radius = Math.hypot(ex, ey) || 1;
    const jitter = (Math.random() * 2 - 1) * CHAOS_JITTER;
    const px = centerX + ex + (ex / radius) * jitter;
    const py = centerY + ey + (ey / radius) * jitter;
    const width = g.widths[key];

    return {
      key,
      x: clamp(px - width / 2, 12, size.width - width - 12),
      y: clamp(py - g.font * 0.54, 8, size.height - g.font * 1.08 - 8),
      rotate: -16 + Math.random() * 32 + index * 0.2,
      visible: true,
    };
  });
}

function recordSort(code: string, order: number[]) {
  const arr = [...order];
  const steps: SortStep[] = [];
  const maxOps = 600;

  const assertIndex = (value: number) => {
    if (!Number.isInteger(value) || value < 0 || value >= arr.length) {
      throw new Error("invalid index");
    }
  };

  const compare = (a: number, b: number) => {
    assertIndex(a);
    assertIndex(b);
    steps.push({ type: "compare", a, b });
    if (steps.length > maxOps) throw new Error("too many operations");
    return Math.sign(arr[a] - arr[b]);
  };

  const swap = (a: number, b: number) => {
    assertIndex(a);
    assertIndex(b);
    steps.push({ type: "swap", a, b });
    if (steps.length > maxOps) throw new Error("too many operations");
    [arr[a], arr[b]] = [arr[b], arr[a]];
  };

  const factory = new Function(
    "compare",
    "swap",
    `"use strict";\n${code}\nreturn typeof bubbleSort === "function" ? bubbleSort : typeof sort === "function" ? sort : null;`,
  );
  const sort = factory(compare, swap) as ((items: number[]) => unknown) | null;

  if (typeof sort !== "function") {
    throw new Error("missing sort function");
  }

  sort(arr);

  return { result: arr, steps };
}

export function SortingMemoryHero() {
  const dictionary = getDictionary();
  const copy = dictionary.marketing.hero;
  const router = useRouter();
  const sceneRef = useRef<HTMLElement | null>(null);
  const runIdRef = useRef(0);
  const [size, setSize] = useState<SceneSize>({ width: 1200, height: 760 });
  const [code, setCode] = useState(DEFAULT_CODE);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [order, setOrder] = useState(() => shuffle([0, 1, 2, 3, 4, 5]));
  const [poses, setPoses] = useState<Pose[]>([]);
  const [activeKeys, setActiveKeys] = useState<number[]>([]);
  const [activeLines, setActiveLines] = useState<number[]>([]);
  const [isSorting, setIsSorting] = useState(false);
  const [motionMode, setMotionMode] = useState<MotionMode>("idle");
  // Whether the letters are currently scattered; a click on empty space toggles
  // between scattering and gathering. Starts scattered to match the intro.
  const [scattered, setScattered] = useState(true);
  // Bumped once the real font metrics are measured, to re-lay-out the word.
  const [metricsVersion, setMetricsVersion] = useState(0);

  // Intro: letters start scattered, then auto-gather after a short beat.
  const introRef = useRef(true);
  const introTimerRef = useRef<number | null>(null);
  const sortRef = useRef<() => void>(() => {});

  // metricsVersion is a dependency so the layout recomputes when glyph widths
  // are refined from the loaded font, even though geometry reads them globally.
  const g = useMemo(() => geometry(size), [size, metricsVersion]);

  const setChaos = useCallback(() => {
    if (isSorting) return;
    const next = shuffle(order);
    runIdRef.current += 1;
    setOrder(next);
    setActiveKeys([]);
    setActiveLines([]);
    setMotionMode("gathering");
    setPoses(chaosPoses(size, next));
    setScattered(true);
  }, [isSorting, order, size]);

  const sort = useCallback(async () => {
    if (isSorting) return;

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    let recording: ReturnType<typeof recordSort>;

    try {
      recording = recordSort(code, order);
    } catch (error) {
      console.error(error);
      return;
    }

    // Which source line each kind of step maps to, so we can light it up while
    // the step plays. Found by keyword, so it survives the user editing the code.
    const codeLines = code.split("\n");
    const lineWith = (needle: string) => codeLines.findIndex((line) => line.includes(needle));
    const compareLine = lineWith("compare(");
    const swapLine = lineWith("swap(");

    setIsSorting(true);
    let slotOrder = [...order];
    setMotionMode("gathering");
    setActiveLines([]);
    setPoses(rowPoses(size, slotOrder));

    await sleep(GATHER_MS);
    if (runIdRef.current !== runId) return;
    setMotionMode("swapping");

    for (const step of recording.steps) {
      if (runIdRef.current !== runId) return;

      const keyA = slotOrder[step.a];
      const keyB = slotOrder[step.b];
      setActiveKeys([keyA, keyB]);
      const stepLine = step.type === "compare" ? compareLine : swapLine;
      setActiveLines(stepLine >= 0 ? [stepLine] : []);

      if (step.type === "compare") {
        await sleep(COMPARE_MS);
        setActiveKeys([]);
        continue;
      }

      const currentRow = rowPoses(size, slotOrder);
      const poseA = currentRow.find((pose) => pose.key === keyA);
      const poseB = currentRow.find((pose) => pose.key === keyB);

      if (poseA && poseB) {
        const nextSlotOrder = [...slotOrder];
        [nextSlotOrder[step.a], nextSlotOrder[step.b]] = [nextSlotOrder[step.b], nextSlotOrder[step.a]];
        const targetRow = rowPoses(size, nextSlotOrder);

        setPoses((current) =>
          current.map((pose) => {
            const target = targetRow.find((rowPose) => rowPose.key === pose.key);
            if (pose.key === keyA && target) return target;
            if (pose.key === keyB && target) return target;
            return pose;
          }),
        );

        await sleep(SWAP_MS);
        slotOrder = nextSlotOrder;
        await sleep(SWAP_PAUSE_MS);
      }

      setActiveKeys([]);
    }

    if (runIdRef.current !== runId) return;

    setActiveKeys([]);
    setActiveLines([]);
    setOrder(recording.result);
    setIsSorting(false);
    setMotionMode("idle");
    setScattered(false);
  }, [code, isSorting, order, size]);

  useEffect(() => {
    sortRef.current = () => {
      void sort();
    };
  }, [sort]);

  const cancelIntro = useCallback(() => {
    introRef.current = false;
    if (introTimerRef.current !== null) {
      window.clearTimeout(introTimerRef.current);
      introTimerRef.current = null;
    }
  }, []);

  // A click on empty space toggles the scene: scatter the letters, then gather
  // (and sort) them on the next click. Clicks on real controls are ignored.
  const handleSceneClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (isSorting) return;
      if (
        (event.target as HTMLElement).closest(
          "a, button, input, textarea, .code-editor, .site-strip, .auth-layer",
        )
      ) {
        return;
      }
      cancelIntro();
      if (scattered) {
        void sort();
      } else {
        setChaos();
      }
    },
    [cancelIntro, isSorting, scattered, setChaos, sort],
  );

  const handleAuthSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      router.push("/dashboard");
    },
    [router],
  );

  useEffect(() => {
    const element = sceneRef.current;
    if (!element) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (poses.length > 0 || isSorting) return;
    setPoses(introRef.current ? chaosPoses(size, order) : rowPoses(size, order));
  }, [isSorting, order, poses.length, size]);

  useEffect(() => {
    // Re-scatter onto the oval for the new viewport while the word is apart;
    // the gathered word is recentred by the effect below.
    if (isSorting || poses.length === 0 || (!introRef.current && !scattered)) return;
    setPoses(chaosPoses(size, order));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // Measure real glyph widths once the font is loaded, then bump the version so
  // the gathered word re-lays out with accurate, even spacing.
  useEffect(() => {
    const apply = () => {
      const ratios = measureGlyphRatios();
      if (ratios && ratios.every((value) => value > 0)) {
        glyphRatios = ratios;
        setMetricsVersion((value) => value + 1);
      }
    };
    apply();
    if (document.fonts?.ready) {
      void document.fonts.ready.then(apply);
    }
  }, []);

  useEffect(() => {
    // Keep the gathered word centred for the current viewport and metrics. Also
    // re-runs when sorting ends, fixing a left shift when the word was first
    // placed before the real (wider) viewport size had been measured.
    if (isSorting || poses.length === 0 || introRef.current || scattered) return;
    setPoses(rowPoses(size, order));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricsVersion, isSorting, size.width, size.height]);

  // Intro auto-gather: hold the scattered word for a beat, then sort it in.
  useEffect(() => {
    introTimerRef.current = window.setTimeout(() => {
      introRef.current = false;
      introTimerRef.current = null;
      sortRef.current();
    }, 1600);
    return () => {
      if (introTimerRef.current !== null) {
        window.clearTimeout(introTimerRef.current);
        introTimerRef.current = null;
      }
    };
  }, []);

  return (
    <main className="minimal-scene" ref={sceneRef} onClick={handleSceneClick}>
      <header className="site-strip">
        <a className="site-brand" href="/" aria-label={copy.homeAria}>
          {dictionary.common.brand}
        </a>
        <nav className="site-nav" aria-label={copy.navAria}>
          {copy.nav.map((item) => (
            <a href={`#${item.toLowerCase()}`} key={item}>
              {item}
            </a>
          ))}
        </nav>
        <div className="site-auth">
          <button
            type="button"
            onClick={() => {
              setAuthMode("login");
              setAuthOpen(true);
            }}
          >
            {copy.auth.login}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("signup");
              setAuthOpen(true);
            }}
          >
            {copy.auth.signup}
          </button>
        </div>
      </header>

      <div className="code-editor">
        <pre className="code-lines" aria-hidden="true">
          {code.split("\n").map((line, index) => (
            <span
              className={activeLines.includes(index) ? "code-line active" : "code-line"}
              key={index}
            >
              {line.length > 0 ? line : " "}
            </span>
          ))}
        </pre>
        <textarea
          aria-label={copy.sortingCodeAria}
          className="code-sheet"
          spellCheck={false}
          wrap="off"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </div>

      <div className="hero-tagline">
        <p className="eyebrow">{copy.eyebrow}</p>
        <p>{copy.tagline}</p>
      </div>

      <div className="word-stage" aria-label={copy.wordAria}>
        {poses.map((pose) => {
          // The further a letter sits from the scene centre, the more it blurs
          // and fades — so scattered letters dissolve and sharpen as they gather.
          const width = g.widths[pose.key];
          const dx = pose.x + width / 2 - size.width / 2;
          const dy = pose.y + g.font * 0.54 - size.height * 0.4;
          // Vertical offset counts double, so letters drifting up/down fade and
          // blur twice as hard as those spreading sideways.
          const distance = Math.hypot(dx, dy * 2);
          const t = clamp((distance - size.width * 0.22) / (size.width * 0.32), 0, 1);
          const blur = t * 7;
          const fade = 1 - t * 0.8;

          return (
            <span
              className={["word-letter", activeKeys.includes(pose.key) ? "active" : ""]
                .concat(`motion-${motionMode}`)
                .filter(Boolean)
                .join(" ")}
              key={pose.key}
              style={{
                fontSize: g.font,
                height: g.font * 1.08,
                opacity: pose.visible ? fade : 0,
                filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
                transform: `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.rotate}deg)`,
                width,
              }}
            >
              {WORD[pose.key]}
            </span>
          );
        })}
      </div>

      {authOpen ? (
        <div className="auth-layer" role="presentation" onMouseDown={() => setAuthOpen(false)}>
          <section
            aria-label={authMode === "login" ? copy.auth.loginAria : copy.auth.signupAria}
            className="auth-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="auth-tabs">
              <button
                className={authMode === "login" ? "active" : ""}
                type="button"
                onClick={() => setAuthMode("login")}
              >
                {copy.auth.login}
              </button>
              <button
                className={authMode === "signup" ? "active" : ""}
                type="button"
                onClick={() => setAuthMode("signup")}
              >
                {copy.auth.signup}
              </button>
            </div>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <label>
                {copy.auth.email}
                <input autoComplete="email" placeholder={copy.auth.emailPlaceholder} type="email" />
              </label>
              <label>
                {copy.auth.password}
                <input
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  placeholder={copy.auth.passwordPlaceholder}
                  type="password"
                />
              </label>
              {authMode === "signup" ? (
                <label>
                  {copy.auth.interviewDate}
                  <input type="date" />
                </label>
              ) : null}
              <button type="submit">
                {authMode === "login" ? copy.auth.continue : copy.auth.createAccount}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
