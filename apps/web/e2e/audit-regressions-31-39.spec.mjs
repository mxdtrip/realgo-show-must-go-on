import { expect, test } from "@playwright/test";

test.describe("audit regressions 31-39", () => {
  test("support mailto form shows a visible manual fallback", async ({ page }) => {
    await page.goto("/support");
    await page.getByLabel("Тема").fill("Не работает уведомление");
    await page.getByLabel("Сообщение").fill("После клика ничего не произошло");
    await page
      .getByRole("button", { name: "Открыть письмо в почте" })
      .evaluate((button) => button.click());

    await expect(page.getByText(/не может проверить, открылся ли почтовый клиент/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Скопировать сообщение" })).toBeVisible();
    await expect(page.getByRole("status").getByText(/mixkageyt@gmail\.com/)).toBeVisible();
  });
});
