import { defineConfig, devices } from "@playwright/test";

// e2e for the auth flow. Boots two throwaway servers (see webServer below):
// the zero-dep auth stub and a production build of the web app pointed at it.
// We use `build && start` rather than `next dev` on purpose: the Next 16 dev
// server's HMR socket fails under headless Chrome and blocks hydration, so the
// page never becomes interactive. NEXT_PUBLIC_* are baked at build time, hence
// they are passed to the build command below.
const WEB_PORT = 3000;
const STUB_PORT = 8080;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/auth-stub.mjs",
      env: { STUB_PORT: String(STUB_PORT) },
      url: `http://127.0.0.1:${STUB_PORT}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npm run build && npm run start -- -p ${WEB_PORT}`,
      env: {
        NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${STUB_PORT}`,
        // Guard bypass ON so /dashboard renders deterministically without a
        // valid session round-trip. The token-clear/keep logic under test lives
        // in AuthProvider + the API client and runs regardless of the guard.
        NEXT_PUBLIC_AUTH_BYPASS: "1",
      },
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
});
