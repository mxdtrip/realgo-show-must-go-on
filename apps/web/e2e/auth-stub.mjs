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

function atlasPayload(withCompany) {
  const subpatterns = [
    {
      code: "binary_search_on_answer",
      name: "Binary Search on Answer",
      position: 1,
      family_codes: ["binary_search"],
      tool_codes: ["tool_arrays"],
      stats: stubStats({ problem_count: 12, solved_count: 3, due_count: 1 }),
      mastery: stubMastery("unstable", 41),
    },
    {
      code: "lower_upper_bound",
      name: "Lower / Upper Bound",
      position: 2,
      family_codes: ["binary_search"],
      tool_codes: ["tool_arrays"],
      stats: stubStats({ problem_count: 4, solved_count: 4 }),
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
    taxonomy_version: "realgo-v1",
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
    taxonomy_version: "realgo-v1",
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
    taxonomy_version: "realgo-v1",
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
    stats: stubStats({ problem_count: 12, solved_count: 3, due_count: 1 }),
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
    taxonomy_version: "realgo-v1",
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

const server = createServer((req, res) => {
  // The web app hits this cross-origin (page :3000 -> api :8080) with a JSON
  // content-type, so the browser sends a preflight. No credentials are used
  // (Bearer header, not cookies), so a wildcard origin is safe and simplest.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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
