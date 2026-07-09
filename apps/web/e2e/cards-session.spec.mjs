import { expect, test } from "@playwright/test";

// Focus card review session (/cards/session): api-backed session with rating
// persistence, and the mock demo fallback for unauthenticated visitors.
// Backed by the CARD_SESSION fixtures in auth-stub.mjs.

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";
const SESSION_KEY = "realgo:card-review-session:v1";

async function openSession(page, { token = null } = {}) {
  await page.goto("/cards");
  await page.evaluate(
    ([a, r, sessionKey, kind]) => {
      localStorage.removeItem(sessionKey);
      if (kind) {
        localStorage.setItem(a, `${kind}.access`);
        localStorage.setItem(r, `${kind}.refresh`);
      } else {
        localStorage.removeItem(a);
        localStorage.removeItem(r);
      }
    },
    [AKEY, RKEY, SESSION_KEY, token],
  );
  await page.goto("/cards/session");
}

test.describe("card review session (api)", () => {
  test("loads the api session, flips, and persists ratings", async ({ page }) => {
    await openSession(page, { token: "LIVE" });

    // First stub card, front side; the AI marker comes from createdByAi.
    await expect(page.getByText("STUB FRONT: which approach fits a sorted array?")).toBeVisible();
    await expect(page.locator(".card-ai-badge")).toBeVisible();
    await expect(page.getByText("Card 1 of 2")).toBeVisible();

    await page.getByRole("button", { name: "Show answer" }).click();
    await expect(page.getByText("STUB BACK: two pointers moving inward.")).toBeVisible();

    // Rating fires POST /me/cards/{id}/rate with the session id.
    const ratePost = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().includes("/me/cards/9101/rate"),
    );
    await page.getByRole("button", { name: /Easy/ }).click();
    const request = await ratePost;
    expect(request.postDataJSON()).toMatchObject({ sessionId: "sess_stub", rating: "easy" });

    // Second card, then completion.
    await expect(page.getByText("STUB FRONT: what breaks on an empty input?")).toBeVisible();
    await page.getByRole("button", { name: "Show answer" }).click();
    await page.getByRole("button", { name: /Easy/ }).click();
    await expect(page.getByText("Повторение завершено.")).toBeVisible();
  });
});

test.describe("card review session (demo fallback)", () => {
  test("falls back to the mock session without auth and stays local", async ({ page }) => {
    const rateCalls = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/rate")) rateCalls.push(request.url());
    });

    await openSession(page);

    // Mock card set from the content module, not the api fixtures.
    await expect(
      page.getByText("Дан отсортированный массив и target. Какой подход выбрать?"),
    ).toBeVisible();
    await expect(page.getByText("STUB FRONT: which approach fits a sorted array?")).toHaveCount(0);

    // Rating advances the local queue without any persistence call.
    await page.getByRole("button", { name: "Show answer" }).click();
    await page.getByRole("button", { name: /Easy/ }).click();
    await expect(page.getByText("Дан отсортированный массив и target. Какой подход выбрать?")).toHaveCount(0);
    expect(rateCalls).toHaveLength(0);
  });
});
