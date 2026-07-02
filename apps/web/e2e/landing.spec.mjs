import { expect, test } from "@playwright/test";

// Regression cover for two landing-page bugs:
//   video: a reload while scrolled down froze the background clip on frame 0
//   faq:   the first question rendered auto-expanded on load

test.describe("landing background video", () => {
  test("keeps scrubbing after a reload while scrolled down (no freeze on frame 0)", async ({ page }) => {
    await page.goto("/");
    // Scroll deep enough that the clip should be near its last frame.
    await page.evaluate(() => window.scrollTo(0, 1600));
    await page.waitForTimeout(1200);

    const before = await page.evaluate(() => {
      const v = document.querySelector(".scroll-video-bg video");
      return v ? v.currentTime : null;
    });
    expect(before).toBeGreaterThan(3.5); // scrub reached the end while scrolled

    // Reload restores the scroll offset; the clip must catch up, not stick at 0.
    await page.reload();
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const v = document.querySelector(".scroll-video-bg video");
            return v ? v.currentTime : 0;
          }),
        { timeout: 8000 },
      )
      .toBeGreaterThan(3.5);
  });
});

test.describe("landing FAQ", () => {
  test("renders with every question collapsed", async ({ page }) => {
    await page.goto("/");
    await page.locator("#faq").scrollIntoViewIfNeeded();

    const openCount = await page.locator(".faq-item.is-open").count();
    expect(openCount).toBe(0);
    await expect(page.locator("#faq-button-0")).toHaveAttribute("aria-expanded", "false");
  });

  test("clicking a question expands it", async ({ page }) => {
    await page.goto("/");
    await page.locator("#faq").scrollIntoViewIfNeeded();
    await page.click("#faq-button-1");
    await expect(page.locator("#faq-button-1")).toHaveAttribute("aria-expanded", "true");
  });
});
