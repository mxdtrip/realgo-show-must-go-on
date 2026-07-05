import { expect, test } from "@playwright/test";

// Cabinet shell UX pack: hotkeys (#118), report-a-problem (#119),
// welcome tour (#122). Page transitions (#117) are pure CSS and not asserted.

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";
const TOUR_KEY = "realgo.cabinet.tour";
const HOTKEYS_KEY = "realgo.cabinet.hotkeys";

async function enterCabinet(page, { tourDone = true } = {}) {
  await page.goto("/dashboard");
  await page.evaluate(
    ([a, r, tourKey, done]) => {
      localStorage.setItem(a, "LIVE.access");
      localStorage.setItem(r, "LIVE.refresh");
      if (done) localStorage.setItem(tourKey, "done");
      else localStorage.removeItem(tourKey);
    },
    [AKEY, RKEY, TOUR_KEY, tourDone],
  );
  await page.goto("/dashboard");
  await expect(page.locator(".cabinet-content")).toBeVisible({ timeout: 15_000 });
}

test.describe("#122 welcome tour", () => {
  test("shows once, skip persists the flag", async ({ page }) => {
    await enterCabinet(page, { tourDone: false });

    const card = page.locator(".tour-card");
    await expect(card).toBeVisible({ timeout: 10_000 });

    await card.locator(".shell-btn--ghost").click(); // «пропустить»
    await expect(card).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), TOUR_KEY)).toBe("done");

    await page.reload();
    await expect(page.locator(".cabinet-content")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1200); // тур стартует с задержкой 600мс — даём ему шанс
    await expect(page.locator(".tour-card")).toHaveCount(0);
  });

  test("walk through all steps to the end", async ({ page }) => {
    await enterCabinet(page, { tourDone: false });
    const card = page.locator(".tour-card");
    await expect(card).toBeVisible({ timeout: 10_000 });

    for (let i = 0; i < 4; i += 1) {
      await card.locator(".shell-btn--primary").click();
    }
    await expect(card).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), TOUR_KEY)).toBe("done");
  });
});

test.describe("#118 hotkeys", () => {
  test("g r navigates to reviews, ? toggles help", async ({ page }) => {
    await enterCabinet(page);

    // Hydration attaches the listener late — retry the sequence until it lands.
    await expect(async () => {
      await page.keyboard.press("g");
      await page.keyboard.press("r");
      await expect(page).toHaveURL(/\/reviews/, { timeout: 1500 });
    }).toPass({ timeout: 20_000 });

    await page.keyboard.press("?");
    const dialog = page.locator(".shell-dialog--hotkeys");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("disable toggle turns navigation off but keeps ?", async ({ page }) => {
    await enterCabinet(page);

    await expect(async () => {
      await page.keyboard.press("?");
      await expect(page.locator(".shell-dialog--hotkeys")).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });

    await page.locator(".hotkeys-toggle input").check();
    expect(await page.evaluate((key) => localStorage.getItem(key), HOTKEYS_KEY)).toBe("off");
    await page.keyboard.press("Escape");

    await page.keyboard.press("g");
    await page.keyboard.press("p");
    await page.waitForTimeout(700);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.keyboard.press("?"); // справка обязана работать даже при off
    await expect(page.locator(".shell-dialog--hotkeys")).toBeVisible();
  });
});

test.describe("#119 report a problem", () => {
  test("dialog opens from topbar, attaches context, ignores hotkeys while typing", async ({
    page,
  }) => {
    await enterCabinet(page);

    const trigger = page.locator(".cabinet-topbar__iconbtn");
    const dialog = page.locator(".shell-dialog--report");
    await expect(async () => {
      await trigger.click();
      await expect(dialog).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });

    const send = dialog.locator(".shell-btn--primary");
    await expect(send).toBeDisabled(); // пустой текст — отправлять нечего

    const textarea = dialog.locator(".report-textarea");
    await textarea.fill("");
    await textarea.pressSequentially("g r что-то сломалось", { delay: 10 });
    await expect(page).toHaveURL(/\/dashboard/); // ввод в поле не дёргает навигацию
    await expect(send).toBeEnabled();

    // Контекст страницы приложен и содержит URL.
    await expect(dialog.locator(".report-context code").first()).toContainText("/dashboard");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});
