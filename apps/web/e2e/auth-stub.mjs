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

    return fail(res, 404, "not_found", `stub: no route ${req.method} ${path}`);
  });
});

// No host arg: bind to the unspecified address (dual-stack) so both
// 127.0.0.1 and ::1/localhost reach the stub, regardless of how the client
// resolves "localhost".
server.listen(PORT, () => {
  console.log(`[auth-stub] listening on :${PORT}`);
});
