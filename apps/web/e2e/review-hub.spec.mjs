import { expect, test } from "@playwright/test";

// The review hub mechanics: /reviews is the single "work today" queue with a
// per-type action on every row, /problems is the live journal, /cards is the
// live deck browser. Backed by the REVIEW_QUEUE / PROBLEMS / DECK_CARDS
// fixtures in auth-stub.mjs.

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";

async function openAuthed(page, path) {
  await page.goto("/dashboard");
  await page.evaluate(
    ([a, r]) => {
      localStorage.setItem(a, "LIVE.access");
      localStorage.setItem(r, "LIVE.refresh");
    },
    [AKEY, RKEY],
  );
  await page.goto(path);
}

test.describe("/reviews — рабочая очередь", () => {
  test("mixed queue renders a matching action per entity type", async ({ page }) => {
    await openAuthed(page, "/reviews");

    // Problem row → external "re-solve" link (the extension closes the loop).
    const resolveLink = page.getByRole("link", { name: /перерешать/ });
    await expect(resolveLink).toBeVisible();
    await expect(resolveLink).toHaveAttribute("href", "https://example.test/koko");
    await expect(resolveLink).toHaveAttribute("target", "_blank");

    // Pattern row → in-app training session for that pattern code.
    const trainLink = page.getByRole("link", { name: /тренировать/ });
    await expect(trainLink).toHaveAttribute("href", "/patterns/sliding_window/session");

    // Card row → the card session covers it.
    const sessionLink = page.getByRole("link", { name: /в сессии карточек/ });
    await expect(sessionLink).toHaveAttribute("href", "/cards/session");

    // Type filter works off entityType, so the card tab counts card rows.
    await page.getByRole("button", { name: /^карточки/ }).click();
    await expect(page.getByText("Stub card: which approach fits a sorted array?")).toBeVisible();
    await expect(page.getByText("Stub Problem: Koko Eating Bananas")).toHaveCount(0);
  });

  test("manual rating posts to the api and removes the row", async ({ page }) => {
    await openAuthed(page, "/reviews");

    await expect(page.getByText("Stub Problem: Koko Eating Bananas")).toBeVisible();
    await page.getByRole("button", { name: "оценить вручную" }).first().click();

    const ratePost = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().includes("/me/reviews/501/rate"),
    );
    await page.getByRole("group", { name: "оценить вручную" }).getByRole("button", { name: "easy" }).click();
    const request = await ratePost;
    expect(request.postDataJSON()).toMatchObject({ rating: "easy" });

    await expect(page.getByText("Stub Problem: Koko Eating Bananas")).toHaveCount(0);
    await expect(page.getByText("Записано:", { exact: false })).toBeVisible();
  });
});

test.describe("/problems — журнал задач", () => {
  test("live rows with status, due marker, atlas link and search", async ({ page }) => {
    await openAuthed(page, "/problems");

    const koko = page.getByRole("link", { name: /Stub Problem: Koko Eating Bananas/ });
    await expect(koko).toHaveAttribute("href", "https://example.test/koko");

    // Status pill + overdue next-review marker from the fixtures.
    await expect(page.locator(".status-pill", { hasText: "повторяется" })).toBeVisible();
    await expect(page.getByText("пора повторить")).toBeVisible();

    // Pattern cell deep-links into the Atlas node.
    await expect(page.getByRole("link", { name: "Binary Search on Answer" })).toHaveAttribute(
      "href",
      "/patterns/binary_search_on_answer",
    );

    // Client search narrows the table.
    await page.getByRole("searchbox").fill("two sum");
    await expect(page.getByText("Stub Problem: Two Sum")).toBeVisible();
    await expect(page.getByText("Stub Problem: Koko Eating Bananas")).toHaveCount(0);

    // Status tabs filter and count.
    await page.getByRole("searchbox").fill("");
    await page.getByRole("button", { name: /освоена/ }).click();
    await expect(page.getByText("Stub Problem: Two Sum")).toBeVisible();
    await expect(page.getByText("Stub Problem: Koko Eating Bananas")).toHaveCount(0);
  });
});

test.describe("/cards — колода", () => {
  test("deck rows render, reveal answers and follow the type filter", async ({ page }) => {
    await openAuthed(page, "/cards");

    // Due hint comes from the session endpoint fixtures (2 cards, ~3 min).
    await expect(page.getByText(/2 к повторению сейчас · ~3 мин/)).toBeVisible();

    const front = page.getByText("STUB DECK: which approach fits a sorted array?");
    await expect(front).toBeVisible();

    // Reveal toggles the back of one card.
    await page.getByRole("button", { name: "показать ответ" }).first().click();
    await expect(page.getByText("STUB DECK BACK: two pointers moving inward.")).toBeVisible();
    await page.getByRole("button", { name: "скрыть ответ" }).click();
    await expect(page.getByText("STUB DECK BACK: two pointers moving inward.")).toHaveCount(0);

    // Type tabs filter the deck.
    await page.getByRole("button", { name: /edge cases/ }).click();
    await expect(page.getByText("STUB DECK: what breaks on an empty input?")).toBeVisible();
    await expect(front).toHaveCount(0);
  });
});
