import { expect, test } from "@playwright/test";

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";
const TOUR_KEY = "realgo.cabinet.tour";

async function enterCabinet(page, path = "/settings") {
  await page.goto(path);
  await page.evaluate(
    ([accessKey, refreshKey, tourKey]) => {
      localStorage.setItem(accessKey, "LIVE.access");
      localStorage.setItem(refreshKey, "LIVE.refresh");
      localStorage.setItem(tourKey, "done");
    },
    [AKEY, RKEY, TOUR_KEY],
  );
  await page.goto(path);
  await expect(page.locator(".cabinet-content")).toBeVisible({ timeout: 15_000 });
}

test.describe("audit regressions 11-19", () => {
  test("notification falls back immediately when no service worker is active", async ({ page }) => {
    await page.addInitScript(() => {
      class FakeNotification {
        static permission = "granted";

        static async requestPermission() {
          return "granted";
        }

        constructor(title, options) {
          window.__realgoNotificationCalls = [...(window.__realgoNotificationCalls ?? []), { title, options }];
        }
      }

      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: FakeNotification,
      });
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          register: async () => ({}),
          getRegistration: async () => undefined,
          // This deliberately never resolves. The production helper must not
          // await it when there is no active registration.
          ready: new Promise(() => {}),
        },
      });
    });

    await enterCabinet(page);
    await page.getByRole("button", { name: "enable" }).click();
    const sendTest = page.getByRole("button", { name: "send test" });
    await expect(sendTest).toBeEnabled();
    await sendTest.click();

    await expect
      .poll(() => page.evaluate(() => window.__realgoNotificationCalls?.length ?? 0), {
        timeout: 2_000,
      })
      .toBe(1);
    await expect(
      page.locator(".notification-settings-panel > small", { hasText: "test notification sent" }),
    ).toBeVisible();
  });

  test("clearing interview date sends null and streak preference reaches the API", async ({ page }) => {
    const bodies = [];
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (
        request.method() === "PATCH" &&
        (pathname.endsWith("/me/profile") || pathname.endsWith("/me/notification-settings"))
      ) {
        bodies.push({ pathname, body: request.postDataJSON() });
      }
    });

    await enterCabinet(page);
    const interviewDate = page.getByLabel("interview date");
    await expect(interviewDate).toHaveValue("2026-07-20");
    await interviewDate.fill("");
    await page.getByRole("button", { name: "save changes" }).click();

    await expect
      .poll(() => bodies.find((entry) => entry.pathname.endsWith("/me/profile"))?.body)
      .toMatchObject({ interview_date: null });

    await page.getByLabel("Защита серии (streak)").check();
    await expect
      .poll(
        () =>
          bodies
            .filter((entry) => entry.pathname.endsWith("/me/notification-settings"))
            .at(-1)?.body,
      )
      .toMatchObject({ streak_reminder: true });
  });

  test("checkout rejects unknown plans and never reports an unsaved success", async ({ page }) => {
    const invalidResponse = await page.goto("/checkout?plan=enterprise");
    expect(invalidResponse?.status()).toBe(404);
    await expect(page.getByText("Pro", { exact: true })).toHaveCount(0);

    await page.goto("/checkout?plan=pro");
    const unavailable = page.getByRole("button", { name: "Оплата временно недоступна" });
    await expect(unavailable).toBeDisabled();
    await expect(page.getByText(/Выбор сохранён|план активен/i)).toHaveCount(0);

    await page.goto("/checkout?plan=free");
    await expect(page.getByRole("link", { name: "Создать бесплатный аккаунт" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  test("report mail hand-off remains explicit instead of claiming it was sent", async ({ page }) => {
    await enterCabinet(page, "/dashboard");
    await page.locator(".user-chip").click();
    await page.locator(".user-menu__report").click();

    const dialog = page.locator(".shell-dialog--report");
    await dialog.locator(".report-textarea").fill("Страница не сохранила изменения");
    await dialog.getByRole("button", { name: "отправить письмо" }).evaluate((button) => button.click());

    await expect(dialog.getByText("отправь письмо в почтовом клиенте", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/не может проверить отправку/i)).toBeVisible();
  });

  test("375px landing has no horizontal overflow and auth copy is Russian", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Войти", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Регистрация", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in", exact: true })).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
  });
});
