// Zero-dependency stand-in for the Go auth API, used only by the Playwright
// e2e suite (apps/web/e2e). It is booted by playwright.config.mjs and torn down
// with the test run — it is never deployed and never long-lived.
//
// Behaviour is deterministic by TOKEN PREFIX, so one instance drives every
// scenario without a restart. /users/me keys off the access bearer; /auth/refresh
// keys off the refresh_token in the body — independently, so a test can mix them:
//
//   LIVE.*  -> 200  healthy session
//   DEAD.*  -> 401  revoked/expired  (client must clear tokens)
//   FLAKY.* -> 500  transient outage (client must KEEP tokens)

import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 8080);
const PREFIX = "/api/v1";

const USER = {
  id: 1,
  email: "e2e@realgo.dev",
  timezone: "UTC",
  plan: "free",
  interview_date: null,
  created_at: "2026-01-01T00:00:00Z",
  onboarding_completed: true,
};

const tokens = (kind) => ({
  access_token: `${kind}.access`,
  refresh_token: `${kind}.refresh`,
  token_type: "Bearer",
  expires_in: 900,
});

function kindOf(token) {
  if (!token) return "NONE";
  if (token.startsWith("LIVE")) return "LIVE";
  if (token.startsWith("DEAD")) return "DEAD";
  if (token.startsWith("FLAKY")) return "FLAKY";
  return "UNKNOWN";
}

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}
const ok = (res, data) => send(res, 200, { data });
const fail = (res, status, code, message) => send(res, status, { error: { code, message } });

// Small deterministic Realgo Taxonomy slice for the /patterns e2e specs.
const stubStats = (over = {}) => ({
  problem_count: 0,
  solved_count: 0,
  in_progress_count: 0,
  due_count: 0,
  card_count: 0,
  attempt_count: 0,
  hard_count: 0,
  ...over,
});

const stubMastery = (status, percent, practice = percent, retention = 100) => ({
  status,
  percent,
  components: { practice, retention },
});

const ATLAS_COMPANIES = [
  { code: "cmp_stub", name: "Stub Corp", subpattern_count: 2, demo_only: true, last_seen_at: "2026-05-01" },
];

const STUB_RELEVANCE = {
  binary_search_on_answer: {
    relevance: "high",
    confidence: "medium",
    evidence_count: 7,
    last_seen_at: "2026-05-01",
    source_type: "demo",
  },
  lower_upper_bound: {
    relevance: "medium",
    confidence: "low",
    evidence_count: 2,
    last_seen_at: "2026-02-01",
    source_type: "demo",
  },
};

// ---- Review hub fixtures (/reviews, /problems, /cards deck) --------------
// dueAt/nextReviewAt lean on "now" so the UI renders the deterministic
// "today / due now" branches regardless of when the suite runs.
const NOW_ISO = new Date().toISOString();
const PAST_ISO = new Date(Date.now() - 3 * 3600_000).toISOString();
const FUTURE_ISO = new Date(Date.now() + 26 * 3600_000).toISOString();

const REVIEW_QUEUE = [
  {
    id: 501,
    entityType: "problem",
    entityId: 41,
    title: "Stub Problem: Koko Eating Bananas",
    meta: "Binary Search · medium",
    typeLabel: "problem review",
    dueAt: NOW_ISO,
    status: "due",
    lastRating: "hard",
    attempts: 3,
    entityUrl: "https://example.test/koko",
    patternCode: "binary_search_on_answer",
  },
  {
    id: 502,
    entityType: "card",
    entityId: 9101,
    title: "Stub card: which approach fits a sorted array?",
    meta: "Two Pointers · pattern_recognition",
    typeLabel: "card review",
    dueAt: NOW_ISO,
    status: "due",
    lastRating: null,
    attempts: 0,
    entityUrl: "",
    patternCode: "two_pointers",
  },
  {
    id: 503,
    entityType: "pattern",
    entityId: 7,
    title: "Sliding Window",
    meta: "Pattern · weak confidence",
    typeLabel: "pattern review",
    dueAt: NOW_ISO,
    status: "due",
    lastRating: "normal",
    attempts: 2,
    entityUrl: "",
    patternCode: "sliding_window",
  },
];

const PROBLEMS = [
  {
    id: 41,
    externalId: "koko-eating-bananas",
    title: "Stub Problem: Koko Eating Bananas",
    url: "https://example.test/koko",
    platform: "leetcode",
    difficulty: "medium",
    pattern: { id: "binary_search_on_answer", name: "Binary Search on Answer" },
    status: "reviewing",
    nextReviewAt: PAST_ISO,
    lastRating: "hard",
    solvedAt: PAST_ISO,
    hintsUsed: 2,
    createdAt: "2026-06-01T10:00:00Z",
    updatedAt: PAST_ISO,
  },
  {
    id: 42,
    externalId: "two-sum-stub",
    title: "Stub Problem: Two Sum",
    url: "https://example.test/two-sum",
    platform: "neetcode",
    difficulty: "easy",
    pattern: null,
    status: "mastered",
    nextReviewAt: FUTURE_ISO,
    lastRating: "easy",
    solvedAt: "2026-06-20T10:00:00Z",
    hintsUsed: 0,
    createdAt: "2026-05-20T10:00:00Z",
    updatedAt: "2026-06-20T10:00:00Z",
  },
];

// Practice set: statuses derive from the atlas mastery fixtures above
// (unstable 41% -> "в работе", mastered 92% -> "освоен", not_started -> "добавлен").
let PRACTICE = [
  { code: "binary_search_on_answer", name: "Binary Search on Answer", addedAt: "2026-07-01T10:00:00Z" },
  { code: "lower_upper_bound", name: "Lower / Upper Bound", addedAt: "2026-07-02T10:00:00Z" },
  { code: "fixed_size_window", name: "Fixed-Size Window", addedAt: "2026-07-03T10:00:00Z" },
];

const DECK_CARDS = [
  {
    id: 9101,
    type: "pattern_recognition",
    source: { entityType: "pattern", entityId: 11, label: "Two Pointers" },
    front: "STUB DECK: which approach fits a sorted array?",
    back: "STUB DECK BACK: two pointers moving inward.",
    status: "due",
    nextReviewAt: PAST_ISO,
    lastRating: "normal",
    createdAt: "2026-06-01T10:00:00Z",
  },
  {
    id: 9102,
    type: "edge_case",
    source: { entityType: "pattern", entityId: 12, label: "Sliding Window" },
    front: "STUB DECK: what breaks on an empty input?",
    back: "STUB DECK BACK: guard the zero-length slice first.",
    status: "mastered",
    nextReviewAt: FUTURE_ISO,
    lastRating: "easy",
    createdAt: "2026-06-02T10:00:00Z",
  },
];

// Deterministic card review session for the /cards/session e2e specs.
const CARD_SESSION = {
  sessionId: "sess_stub",
  scope: "due",
  estimatedMinutes: 3,
  cards: [
    {
      id: 9101,
      type: "pattern_recognition",
      sourceLabel: "Stub Problem · Two Pointers",
      front: "STUB FRONT: which approach fits a sorted array?",
      back: "STUB BACK: two pointers moving inward.",
      createdByAi: true,
      reviewState: { attempts: 0, lastRating: null, nextReviewAt: null },
    },
    {
      id: 9102,
      type: "edge_case",
      sourceLabel: "Stub Problem · Edge Cases",
      front: "STUB FRONT: what breaks on an empty input?",
      back: "STUB BACK: guard the zero-length slice first.",
      createdByAi: false,
      reviewState: { attempts: 1, lastRating: "normal", nextReviewAt: "2026-07-01T00:00:00Z" },
    },
  ],
};

function atlasPayload(withCompany) {
  const subpatterns = [
    {
      code: "binary_search_on_answer",
      name: "Binary Search on Answer",
      position: 1,
      family_codes: ["binary_search"],
      tool_codes: ["tool_arrays"],
      stats: stubStats({
        problem_count: 12,
        solved_count: 3,
        due_count: 1,
        difficulty_counts: { easy: 3, medium: 6, hard: 3 },
      }),
      mastery: stubMastery("unstable", 41),
    },
    {
      code: "lower_upper_bound",
      name: "Lower / Upper Bound",
      position: 2,
      family_codes: ["binary_search"],
      tool_codes: ["tool_arrays"],
      stats: stubStats({ problem_count: 4, solved_count: 4, difficulty_counts: { easy: 2, medium: 2 } }),
      mastery: stubMastery("mastered", 92),
    },
    {
      code: "fixed_size_window",
      name: "Fixed-Size Window",
      position: 3,
      family_codes: ["sliding_window"],
      tool_codes: ["tool_arrays"],
      stats: stubStats(),
      mastery: stubMastery("not_started", 0),
    },
  ];
  if (withCompany) {
    for (const sub of subpatterns) {
      if (STUB_RELEVANCE[sub.code]) sub.relevance = STUB_RELEVANCE[sub.code];
    }
  }
  return {
    taxonomy_version: "realgo-v2",
    tools: [
      { code: "tool_arrays", name: "Arrays", position: 1, subpattern_codes: ["binary_search_on_answer", "lower_upper_bound", "fixed_size_window"] },
      { code: "tool_hash_map", name: "Hash Map", position: 2, subpattern_codes: [] },
    ],
    families: [
      {
        code: "binary_search",
        name: "Binary Search",
        description: "",
        position: 1,
        subpattern_codes: ["binary_search_on_answer", "lower_upper_bound"],
      },
      {
        code: "sliding_window",
        name: "Sliding Window",
        description: "",
        position: 2,
        subpattern_codes: ["fixed_size_window"],
      },
    ],
    subpatterns,
    company: withCompany
      ? {
          code: "cmp_stub",
          name: "Stub Corp",
          demo_only: true,
          coverage: {
            relevant_subpatterns: 2,
            strong: 1,
            unstable: 1,
            weak: 0,
            not_started: 0,
            top_gaps: [
              { code: "binary_search_on_answer", name: "Binary Search on Answer", relevance: "high", mastery_percent: 41 },
            ],
          },
        }
      : undefined,
  };
}

const ATLAS_NODES = {
  binary_search: {
    code: "binary_search",
    name: "Binary Search",
    kind: "family",
    description: "Family node stub rendered as the pattern profile page.",
    taxonomy_version: "realgo-v2",
    techniques: [],
    recognition_symptoms: [],
    checklist: [],
    example_problems: [],
    subpatterns: [
      { code: "binary_search_on_answer", name: "Binary Search on Answer" },
      { code: "lower_upper_bound", name: "Lower / Upper Bound" },
    ],
    cards: [],
    practice: [],
    company_practice: [],
    relevant_companies: [],
  },
  binary_search_on_answer: {
    code: "binary_search_on_answer",
    name: "Binary Search on Answer",
    kind: "subpattern",
    description: "",
    taxonomy_version: "realgo-v2",
    techniques: [],
    recognition_symptoms: [],
    checklist: [],
    example_problems: [],
    families: [{ code: "binary_search", name: "Binary Search" }],
    tools: [{ code: "tool_arrays", name: "Arrays" }],
    material: {
      what_it_is: "Стаб: поиск по пространству ответов.",
      mental_model: "Стаб: монотонный предикат.",
      recognition_cues: ["Минимальная скорость, чтобы успеть"],
      anti_cues: ["Предикат не монотонен"],
      core_invariant: "Граница всегда в [lo, hi].",
      canonical_skeleton: "while lo < hi: ...",
      common_mistakes: ["hi = mid - 1 при поиске минимума"],
      dont_confuse_with: [{ title: "Exact Binary Search", note: "ищет элемент, а не границу" }],
    },
    stats: stubStats({
      problem_count: 12,
      solved_count: 3,
      due_count: 1,
      difficulty_counts: { easy: 2, medium: 7, hard: 3 },
    }),
    mastery: stubMastery("unstable", 41),
    cards: [],
    practice: [
      { id: 1, title: "Koko Eating Bananas", url: "https://example.test/koko", difficulty: "medium", tier: "core", status: "solved" },
      { id: 2, title: "Split Array Largest Sum", url: "https://example.test/split", difficulty: "hard", tier: "advanced", status: "not_started" },
    ],
    company_practice: [
      {
        company: { code: "cmp_stub", name: "Stub Corp" },
        problems: [
          { id: 1, title: "Koko Eating Bananas", url: "https://example.test/koko", difficulty: "medium", status: "solved", evidence_count: 4, last_seen_at: "2026-05-01", source_type: "demo" },
        ],
      },
    ],
    relevant_companies: [
      { code: "cmp_stub", name: "Stub Corp", relevance: "high", confidence: "medium", evidence_count: 7, last_seen_at: "2026-05-01", source_type: "demo" },
    ],
  },
  fixed_size_window: {
    code: "fixed_size_window",
    name: "Fixed-Size Window",
    kind: "subpattern",
    description: "",
    taxonomy_version: "realgo-v2",
    techniques: [],
    recognition_symptoms: [],
    checklist: [],
    example_problems: [],
    families: [{ code: "sliding_window", name: "Sliding Window" }],
    tools: [{ code: "tool_arrays", name: "Arrays" }],
    stats: stubStats(),
    mastery: stubMastery("not_started", 0),
    cards: [],
    practice: [],
    company_practice: [],
    relevant_companies: [],
  },
};

// ---- Dashboard / roadmap / extension fixtures -----------------------------
const dayKey = (agoDays) => {
  const d = new Date();
  d.setDate(d.getDate() - agoDays);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DASHBOARD = {
  nextAction: {
    type: "problem_review",
    title: "2 повторений на сегодня",
    description: "Binary Search · medium",
    href: "/reviews",
    dueAt: NOW_ISO,
  },
  stats: [
    { key: "today_queue", label: "today queue", value: 2, displayValue: "2", hint: "1 задач, 1 карточек, 0 паттернов", tone: "accent" },
    { key: "solved_total", label: "solved", value: 12, displayValue: "12", hint: "решено задач всего", tone: "default" },
    { key: "streak", label: "streak", value: 4, displayValue: "4", hint: "дней подряд активности", tone: "accent" },
    { key: "readiness", label: "readiness", value: 61, displayValue: "61%", hint: "оценка готовности", tone: "warning" },
  ],
  reviewPreview: [
    {
      id: "501",
      type: "problem_review",
      title: "Stub Problem: Koko Eating Bananas",
      meta: "Binary Search · medium",
      dueAt: NOW_ISO,
      lastRating: "hard",
    },
  ],
  weakPatterns: [
    { id: "pat_binary_search", name: "Binary Search", confidence: 40, signal: "3 hard из 4 повторений" },
  ],
  activity: {
    days: [
      { date: dayKey(3), count: 2 },
      { date: dayKey(1), count: 5 },
      { date: dayKey(0), count: 3 },
    ],
    activeDays: 3,
    totalReviews: 10,
  },
};

const ROADMAP = {
  overallProgress: 34,
  target: { company: null, interviewDate: null },
  weeks: [
    {
      id: "week_01",
      label: "week 01",
      title: "Arrays & Hashing",
      progress: 100,
      focus: "solve pattern problems and reviews",
      status: "done",
      topics: ["arrays_hashing"],
    },
    {
      id: "week_02",
      label: "week 02",
      title: "Two Pointers",
      progress: 40,
      focus: "solve pattern problems and reviews",
      status: "active",
      topics: ["two_pointers"],
    },
  ],
  patterns: [],
};

const EXTENSION_STATUS = {
  connected: true,
  platforms: [{ source: "leetcode", status: "connected", lastSyncAt: PAST_ISO }],
  recentEvents: [
    {
      id: "evt-1",
      source: "leetcode",
      event: "problem_solved",
      title: "Stub Problem: Koko Eating Bananas",
      occurredAt: NOW_ISO,
    },
    {
      id: "evt-2",
      source: "leetcode",
      event: "problem_viewed",
      title: "Two Sum",
      occurredAt: PAST_ISO,
    },
  ],
};

const server = createServer((req, res) => {
  // The web app hits this cross-origin (page :3000 -> api :8080) with a JSON
  // content-type, so the browser sends a preflight. No credentials are used
  // (Bearer header, not cookies), so a wildcard origin is safe and simplest.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  const path = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (path === "/healthz") {
    ok(res, { status: "ok" });
    return;
  }

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      /* leave body empty */
    }

    if (req.method === "POST" && (path === `${PREFIX}/auth/login` || path === `${PREFIX}/auth/register`)) {
      return ok(res, { user: USER, tokens: tokens("LIVE") });
    }

    if (req.method === "GET" && path === `${PREFIX}/users/me`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const kind = kindOf(bearer);
      if (kind === "LIVE") return ok(res, { user: USER });
      if (kind === "FLAKY") return fail(res, 500, "server_error", "stub transient failure");
      return fail(res, 401, "unauthorized", "stub: session invalid");
    }

    if (req.method === "POST" && path === `${PREFIX}/auth/refresh`) {
      const kind = kindOf(body.refresh_token);
      if (kind === "LIVE") return ok(res, { tokens: tokens("LIVE") });
      if (kind === "FLAKY") return fail(res, 500, "server_error", "stub transient failure");
      return fail(res, 401, "invalid_refresh", "stub: refresh rejected");
    }

    if (req.method === "POST" && path === `${PREFIX}/auth/logout`) {
      return ok(res, { status: "ok" });
    }

    // ---- Dashboard / roadmap / extension fixtures ----------------------
    if (req.method === "GET" && path === `${PREFIX}/me/dashboard`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, DASHBOARD);
    }

    if (req.method === "GET" && path === `${PREFIX}/me/roadmap`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, ROADMAP);
    }

    if (req.method === "GET" && path === `${PREFIX}/me/extension/status`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, EXTENSION_STATUS);
    }

    // ---- Review hub fixtures (/reviews, /problems, /cards deck) --------
    if (req.method === "GET" && path === `${PREFIX}/me/reviews/queue`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return send(res, 200, { data: REVIEW_QUEUE, meta: { nextCursor: null } });
    }

    if (req.method === "POST" && /^\/api\/v1\/me\/reviews\/\d+\/rate$/.test(path)) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      if (!["hard", "normal", "easy"].includes(body.rating)) {
        return fail(res, 400, "validation_error", "stub: bad rating");
      }
      const reviewId = Number(path.split("/").at(-2));
      return ok(res, {
        reviewId,
        rating: body.rating,
        nextReviewAt: FUTURE_ISO,
        status: "completed",
      });
    }

    if (req.method === "GET" && path === `${PREFIX}/me/problems`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return send(res, 200, { data: PROBLEMS, meta: { nextCursor: null } });
    }

    if (req.method === "GET" && path === `${PREFIX}/me/cards`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return send(res, 200, { data: DECK_CARDS, meta: { nextCursor: null } });
    }

    // ---- Practice set fixtures (/problems, /cards launcher) ------------
    if (path === `${PREFIX}/me/practice` && req.method === "GET") {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, { subpatterns: PRACTICE });
    }

    if (path === `${PREFIX}/me/practice/subpatterns` && req.method === "POST") {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      if (!body.code) return fail(res, 400, "validation_error", "stub: code required");
      if (!PRACTICE.some((item) => item.code === body.code)) {
        PRACTICE.push({ code: body.code, name: body.code, addedAt: new Date().toISOString() });
      }
      return ok(res, { code: body.code, active: true });
    }

    if (req.method === "DELETE" && path.startsWith(`${PREFIX}/me/practice/subpatterns/`)) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      const code = decodeURIComponent(path.split("/").at(-1));
      PRACTICE = PRACTICE.filter((item) => item.code !== code);
      res.writeHead(204);
      res.end();
      return;
    }

    // ---- Card session fixtures (e2e for /cards/session) ----------------
    if (path === `${PREFIX}/me/cards/session` && req.method === "GET") {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const kind = kindOf(bearer);
      if (kind === "FLAKY") return fail(res, 500, "server_error", "stub transient failure");
      if (kind !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, CARD_SESSION);
    }

    if (req.method === "POST" && /^\/api\/v1\/me\/cards\/\d+\/rate$/.test(path)) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      if (body.sessionId !== CARD_SESSION.sessionId) {
        return fail(res, 400, "validation_error", "stub: unknown sessionId");
      }
      if (!["hard", "normal", "easy"].includes(body.rating)) {
        return fail(res, 400, "validation_error", "stub: bad rating");
      }
      const cardId = Number(path.split("/").at(-2));
      return ok(res, {
        cardId,
        rating: body.rating,
        nextReviewAt: "2026-07-12T00:00:00Z",
        repeatInCurrentSession: body.rating === "hard",
        sessionProgress: { reviewed: 1, total: CARD_SESSION.cards.length, remaining: 1 },
      });
    }

    // ---- Pattern Atlas fixtures (e2e for /patterns) --------------------
    if (req.method === "GET" && path.startsWith(`${PREFIX}/me/patterns/atlas`)) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const kind = kindOf(bearer);
      if (kind === "FLAKY") return fail(res, 500, "server_error", "stub transient failure");
      if (kind !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");

      if (path === `${PREFIX}/me/patterns/atlas/companies`) {
        return ok(res, { companies: ATLAS_COMPANIES });
      }
      if (path === `${PREFIX}/me/patterns/atlas`) {
        const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
        const company = url.searchParams.get("company");
        if (company && company !== "cmp_stub") {
          return fail(res, 404, "not_found", "stub: unknown company");
        }
        return ok(res, atlasPayload(Boolean(company)));
      }
      const code = path.slice(`${PREFIX}/me/patterns/atlas/`.length);
      const node = ATLAS_NODES[code];
      if (!node) return fail(res, 404, "not_found", "stub: unknown atlas node");
      return ok(res, node);
    }

    return fail(res, 404, "not_found", `stub: no route ${req.method} ${path}`);
  });
});

// No host arg: bind to the unspecified address (dual-stack) so both
// 127.0.0.1 and ::1/localhost reach the stub, regardless of how the client
// resolves "localhost".
server.listen(PORT, () => {
  console.log(`[auth-stub] listening on :${PORT}`);
});
