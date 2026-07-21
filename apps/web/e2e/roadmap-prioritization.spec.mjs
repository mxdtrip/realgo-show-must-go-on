import { expect, test } from "@playwright/test";

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";
const TOUR_KEY = "realgo.cabinet.tour";

async function authenticate(page) {
  await page.goto("/dashboard");
  await page.evaluate(
    ([accessKey, refreshKey, tourKey]) => {
      localStorage.setItem(accessKey, "LIVE.access");
      localStorage.setItem(refreshKey, "LIVE.refresh");
      localStorage.setItem(tourKey, "done");
    },
    [AKEY, RKEY, TOUR_KEY],
  );
}

test("onboarding previews and saves a roadmap priority mode", async ({ page }) => {
  await authenticate(page);
  await page.goto("/onboarding/profile?force=1");

  await page.getByRole("radio", { name: "LeetCode" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByLabel("компания").fill("Google");
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Далее" }).click();

  await expect(page.getByText("Как расставить темы?")).toBeVisible();
  await page.getByRole("button", { name: "Легче → сложнее" }).click();
  await expect(page.getByText("Сначала темы с большей долей easy-задач, затем medium и hard.")).toBeVisible();
  await expect(page.getByText("тем в резерве")).toBeVisible();

  await page.getByRole("button", { name: "Далее" }).click();
  await expect(page.getByText("Добро пожаловать в ReAlgo")).toBeVisible();
  await expect(page.getByText("Легче → сложнее")).toBeVisible();
});

test("roadmap previews mode changes before rebuilding future weeks", async ({ page }) => {
  await authenticate(page);
  await page.goto("/roadmap");

  await expect(page.getByText("Порядок тем")).toBeVisible();
  await page.getByRole("button", { name: "Чаще спрашивают" }).click();
  await expect(page.getByText(/Предпросмотр: завершённые и текущая недели/)).toBeVisible();
  await page.getByRole("button", { name: "перестроить будущие недели" }).click();
  await expect(page.getByRole("button", { name: "Чаще спрашивают" })).toHaveAttribute("aria-pressed", "true");
});
