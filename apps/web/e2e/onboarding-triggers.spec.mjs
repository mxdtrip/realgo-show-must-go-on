import { expect, test } from "@playwright/test";

// Тест-триггеры онбордингов: welcome-тур перезапускается хоткеем `g w` или
// URL `?tour=1`; полевой онбординг открывается заново через
// /onboarding/profile?force=1 (хоткей `g o` из кабинета). Штатные гейты
// (done-флаг тура, редирект уже онбордившихся) при этом не ослабляются.

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";
const TOUR_KEY = "realgo.cabinet.tour";

async function enterCabinet(page) {
  await page.goto("/dashboard");
  await page.evaluate(
    ([a, r, tourKey]) => {
      localStorage.setItem(a, "LIVE.access");
      localStorage.setItem(r, "LIVE.refresh");
      localStorage.setItem(tourKey, "done");
    },
    [AKEY, RKEY, TOUR_KEY],
  );
  await page.goto("/dashboard");
  await expect(page.locator(".cabinet-content")).toBeVisible({ timeout: 15_000 });
}

test.describe("welcome tour re-triggers", () => {
  test("?tour=1 forces the tour despite the done flag", async ({ page }) => {
    await enterCabinet(page);
    await expect(page.locator(".tour-card")).toHaveCount(0);

    await page.goto("/dashboard?tour=1");
    await expect(page.locator(".tour-card")).toBeVisible({ timeout: 15_000 });

    // done-флаг не тронут: обычная загрузка тур не показывает.
    await page.goto("/dashboard");
    await expect(page.locator(".cabinet-content")).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page.locator(".tour-card")).toHaveCount(0);
  });

  test("hotkey g w restarts the tour", async ({ page }) => {
    await enterCabinet(page);

    await page.keyboard.press("g");
    await page.keyboard.press("w");
    await expect(page.locator(".tour-card")).toBeVisible();

    // esc закрывает и снова записывает done.
    await page.keyboard.press("Escape");
    await expect(page.locator(".tour-card")).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), TOUR_KEY)).toBe("done");
  });
});

test.describe("field onboarding re-triggers", () => {
  test("onboarded user is redirected without force, stays with force=1", async ({ page }) => {
    // Стаб-юзер приходит с onboarding_completed: true.
    await enterCabinet(page);

    await page.goto("/onboarding/profile");
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.goto("/onboarding/profile?force=1");
    await expect(page.getByText("В какие компании хочешь устроиться?")).toBeVisible({ timeout: 15_000 });
  });

  test("hotkey g o opens the forced field onboarding", async ({ page }) => {
    await enterCabinet(page);

    await page.keyboard.press("g");
    await page.keyboard.press("o");
    await page.waitForURL("**/onboarding/profile?force=1", { timeout: 15_000 });
    await expect(page.getByText("В какие компании хочешь устроиться?")).toBeVisible();
  });
});
