import { expect, test } from "@playwright/test";

// Regression cover for the two QA bugs fixed in fix/web-auth-form-and-logo-session:
//   #1 landing login modal reset the form and redirected to /login
//   #2 cabinet logo dropped the session; refresh cleared tokens on any failure

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";

const readTokens = (page) =>
  page.evaluate(([a, r]) => [localStorage.getItem(a), localStorage.getItem(r)], [AKEY, RKEY]);

const seedTokens = (page, accessKind, refreshKind) =>
  page.evaluate(
    ([a, r, av, rv]) => {
      localStorage.setItem(a, av);
      localStorage.setItem(r, rv);
    },
    [AKEY, RKEY, `${accessKind}.access`, `${refreshKind}.refresh`],
  );

async function openLoginModal(page) {
  await page.goto("/");
  const trigger = page.locator(".site-auth button").first();
  const form = page.locator(".auth-layer .auth-form");
  // The modal opens via React state, so the click is a no-op until hydration
  // attaches the handler. Retry the click until the form actually appears.
  await expect(async () => {
    await trigger.click();
    await expect(form).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
}

test.describe("bug #1 — landing login modal", () => {
  test("Enter submits in place and lands on /dashboard on success", async ({ page }) => {
    await openLoginModal(page);
    await page.fill('.auth-form input[type="email"]', "e2e@realgo.dev");
    await page.fill('.auth-form input[type="password"]', "supersecret123");
    await page.locator('.auth-form input[type="password"]').press("Enter");

    await page.waitForURL("**/dashboard", { timeout: 20_000 });
    const [access, refresh] = await readTokens(page);
    expect(access).toContain("LIVE");
    expect(refresh).toContain("LIVE");
  });

  test("invalid password keeps the modal — no redirect to /login", async ({ page }) => {
    await openLoginModal(page);
    await page.fill('.auth-form input[type="email"]', "e2e@realgo.dev");
    await page.fill('.auth-form input[type="password"]', "short"); // < 8 -> native block
    await page.locator('.auth-form button[type="submit"]').click();
    await page.waitForTimeout(500);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".auth-layer .auth-form")).toBeVisible();
  });
});

test.describe("bug #2 — cabinet logo & session hardening", () => {
  test("logo points to /dashboard and click keeps the session", async ({ page }) => {
    await page.goto("/dashboard");
    await seedTokens(page, "LIVE", "LIVE");
    await page.goto("/dashboard"); // getMe(LIVE) -> 200 -> authenticated -> guard renders

    const brand = page.locator(".cabinet-brand-block a.site-brand").first();
    await expect(brand).toBeVisible({ timeout: 15_000 });
    await expect(brand).toHaveAttribute("href", "/dashboard");

    await brand.click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/dashboard/);
    expect(await readTokens(page)).toEqual(["LIVE.access", "LIVE.refresh"]);
  });

  test("revoked session (refresh 401) clears tokens", async ({ page }) => {
    await page.goto("/dashboard");
    await seedTokens(page, "DEAD", "DEAD"); // getMe 401 -> refresh 401 -> clearTokens
    await page.goto("/dashboard");

    await expect
      .poll(async () => await readTokens(page), { timeout: 10_000 })
      .toEqual([null, null]);
  });

  test("transient refresh failure (500) keeps the session", async ({ page }) => {
    await page.goto("/dashboard");
    await seedTokens(page, "DEAD", "FLAKY"); // getMe 401 -> refresh 500 -> must NOT clear
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);

    // This is the exact line the fix changed: only a genuine 401 wipes tokens.
    expect(await readTokens(page)).toEqual(["DEAD.access", "FLAKY.refresh"]);
  });
});
