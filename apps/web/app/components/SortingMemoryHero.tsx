"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getDictionary } from "../_content/i18n";

const WORD = "engram";
const LETTER_COUNT = WORD.length;
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
  // Slot wide enough that even the widest glyph ('m') clears its neighbours,
  // plus an explicit, even gap so the letters breathe instead of touching.
  const letterWidth = font * 0.6;
  const gap = clamp(font * 0.18, 12, 22);
  const total = LETTER_COUNT * letterWidth + (LETTER_COUNT - 1) * gap;

  return {
    font,
    letterWidth,
    gap,
    startX: (size.width - total) / 2,
    // Sit the word above the vertical centre (0.5 = middle, lower = higher).
    y: size.height * 0.4 - font * 0.56,
  };
}

function rowPoses(size: SceneSize, order: number[]) {
  const g = geometry(size);

  return order.map((key, index) => ({
    key,
    x: g.startX + index * (g.letterWidth + g.gap),
    y: g.y,
    rotate: 0,
    visible: true,
  }));
}

function chaosPoses(size: SceneSize, order: number[]) {
  const g = geometry(size);
  const safeTop = Math.max(130, size.height * 0.22);
  const safeBottom = Math.max(safeTop + 1, size.height - g.font * 1.1 - 90);

  return order.map((key, index) => ({
    key,
    x: clamp(Math.random() * (size.width - g.letterWidth), 18, size.width - g.letterWidth - 18),
    y: clamp(safeTop + Math.random() * (safeBottom - safeTop), safeTop, safeBottom),
    rotate: -16 + Math.random() * 32 + index * 0.2,
    visible: true,
  }));
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
  const [isSorting, setIsSorting] = useState(false);
  const [motionMode, setMotionMode] = useState<MotionMode>("idle");
  const [activeAction, setActiveAction] = useState<"chaos" | "sort">("chaos");

  // Intro: letters start scattered, then auto-gather after a short beat.
  const introRef = useRef(true);
  const introTimerRef = useRef<number | null>(null);
  const sortRef = useRef<() => void>(() => {});

  const g = useMemo(() => geometry(size), [size]);

  const setChaos = useCallback(() => {
    if (isSorting) return;
    const next = shuffle(order);
    runIdRef.current += 1;
    setOrder(next);
    setActiveKeys([]);
    setMotionMode("gathering");
    setPoses(chaosPoses(size, next));
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

    setIsSorting(true);
    let slotOrder = [...order];
    setMotionMode("gathering");
    setPoses(rowPoses(size, slotOrder));

    await sleep(GATHER_MS);
    if (runIdRef.current !== runId) return;
    setMotionMode("swapping");

    for (const step of recording.steps) {
      if (runIdRef.current !== runId) return;

      const keyA = slotOrder[step.a];
      const keyB = slotOrder[step.b];
      setActiveKeys([keyA, keyB]);

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
    setOrder(recording.result);
    setIsSorting(false);
    setMotionMode("idle");
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

  const handleChaos = useCallback(() => {
    if (isSorting) return;
    cancelIntro();
    setActiveAction("chaos");
    setChaos();
  }, [cancelIntro, isSorting, setChaos]);

  const handleSort = useCallback(() => {
    if (isSorting) return;
    cancelIntro();
    setActiveAction("sort");
    void sort();
  }, [cancelIntro, isSorting, sort]);

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
    if (isSorting || poses.length === 0) return;
    // While intro is scattered, keep it scattered (re-cast at the real size);
    // afterwards keep the word centered on viewport resize.
    setPoses(introRef.current ? chaosPoses(size, order) : rowPoses(size, order));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // Intro auto-gather: hold the scattered word for a beat, then sort it in.
  useEffect(() => {
    introTimerRef.current = window.setTimeout(() => {
      introRef.current = false;
      introTimerRef.current = null;
      setActiveAction("sort");
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
    <main className="minimal-scene" ref={sceneRef}>
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

      <textarea
        aria-label={copy.sortingCodeAria}
        className="code-sheet"
        spellCheck={false}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />

      <div className="hero-tagline">
        <p className="eyebrow">{copy.eyebrow}</p>
        <p>{copy.tagline}</p>
      </div>

      <div
        className="scene-toggle"
        role="group"
        aria-label={copy.sortingControlsAria}
        data-active={activeAction}
      >
        <span className="scene-toggle__thumb" aria-hidden="true" />
        <button
          className={activeAction === "chaos" ? "active" : ""}
          disabled={isSorting}
          type="button"
          onClick={handleChaos}
        >
          {copy.chaos}
        </button>
        <button
          className={activeAction === "sort" ? "active" : ""}
          disabled={isSorting}
          type="button"
          onClick={handleSort}
        >
          {copy.sort}
        </button>
      </div>

      <div className="word-stage" aria-label={copy.wordAria}>
        {poses.map((pose) => (
          <span
            className={["word-letter", activeKeys.includes(pose.key) ? "active" : ""]
              .concat(`motion-${motionMode}`)
              .filter(Boolean)
              .join(" ")}
            key={pose.key}
            style={{
              fontSize: g.font,
              height: g.font * 1.08,
              opacity: pose.visible ? 1 : 0,
              transform: `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.rotate}deg)`,
              width: g.letterWidth,
            }}
          >
            {WORD[pose.key]}
          </span>
        ))}
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
