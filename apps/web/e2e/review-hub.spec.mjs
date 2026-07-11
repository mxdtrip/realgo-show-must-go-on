import { expect, test } from "@playwright/test";

// The reworked cabinet mechanics: /reviews is the journal of problems solved
// on platforms (status, hints used, self-rating), /problems tracks the
// practice set of subpatterns per stage. /cards is the original mock-driven
// launcher (unrelated to this rework). Backed by the PROBLEMS / PRACTICE
// fixtures in auth-stub.mjs.

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";

async function openAuthed(page, path) {
  await page.goto("/dashboard");
  await page.evaluate(
    ([a, r]) => {
      localStorage.setItem(a, "LIVE.access");
      localStorage.setItem(r, "LIVE.refresh");
      localStorage.setItem("realgo.cabinet.tour", "done");
    },
    [AKEY, RKEY],
  );
  await page.goto(path);
}

test.describe("/reviews — журнал решённых задач", () => {
  test("rows carry status, hints used, self-rating and due marker", async ({ page }) => {
    await openAuthed(page, "/reviews");

    const koko = page.getByRole("link", { name: /Stub Problem: Koko Eating Bananas/ });
    await expect(koko).toHaveAttribute("href", "https://example.test/koko");

    const kokoRow = page.getByRole("row", { name: /Koko Eating Bananas/ });
    // Difficulty renders as bare colored text, not a pill.
    await expect(kokoRow.locator(".difficulty-text--medium")).toHaveText("medium");
    // Hints used comes from the assistant log join.
    await expect(kokoRow.getByText("2", { exact: true })).toBeVisible();
    // Self-rating from the extension popup.
    await expect(kokoRow.locator(".review-badge--warning")).toHaveText("hard");

    // Pattern cell deep-links into the Atlas node.
    await expect(page.getByRole("link", { name: "Binary Search on Answer" })).toHaveAttribute(
      "href",
      "/patterns/binary_search_on_answer",
    );

    // Search and status tabs narrow the journal.
    await page.getByRole("searchbox").fill("two sum");
    await expect(page.getByText("Stub Problem: Two Sum")).toBeVisible();
    await expect(page.getByText("Stub Problem: Koko Eating Bananas")).toHaveCount(0);

    await page.getByRole("searchbox").fill("");
    await page.getByRole("button", { name: /освоена/ }).click();
    await expect(page.getByText("Stub Problem: Two Sum")).toBeVisible();
    await expect(page.getByText("Stub Problem: Koko Eating Bananas")).toHaveCount(0);
  });
});

test.describe("/problems — практика подпаттернов", () => {
  test("stages derive from mastery; a row can leave the practice set", async ({ page }) => {
    await openAuthed(page, "/problems");

    // Three fixtures → three distinct stages.
    const working = page.locator(".practice-item", { hasText: "Binary Search on Answer" });
    await expect(working.locator(".status-pill")).toHaveText("в работе");
    const mastered = page.locator(".practice-item", { hasText: "Lower / Upper Bound" });
    await expect(mastered.locator(".status-pill")).toHaveText("освоен");
    const added = page.locator(".practice-item", { hasText: "Fixed-Size Window" });
    await expect(added.locator(".status-pill")).toHaveText("добавлен");

    // Name links into the Atlas node page.
    await expect(page.getByRole("link", { name: "Binary Search on Answer" })).toHaveAttribute(
      "href",
      "/patterns/binary_search_on_answer",
    );

    // Stage tabs filter the list.
    await page.getByRole("button", { name: /освоен/ }).click();
    await expect(page.getByText("Lower / Upper Bound")).toBeVisible();
    await expect(page.getByText("Binary Search on Answer")).toHaveCount(0);
    await page.getByRole("button", { name: /^all/ }).click();

    // Removing fires DELETE /me/practice/subpatterns/{code} and drops the row.
    const del = page.waitForRequest(
      (request) =>
        request.method() === "DELETE" &&
        request.url().includes("/me/practice/subpatterns/fixed_size_window"),
    );
    await added.getByRole("button", { name: "убрать из практики" }).click();
    await del;
    await expect(page.locator(".practice-item", { hasText: "Fixed-Size Window" })).toHaveCount(0);
  });
});

test.describe("/dashboard — лаунчер практики", () => {
  test("launcher shows live practice numbers and starts scope=practice", async ({ page }) => {
    await openAuthed(page, "/dashboard");

    const launcher = page.locator(".next-up");
    await expect(launcher.getByText("Практика по активным подпаттернам")).toBeVisible();
    // 3 practice subpatterns · 2 session cards · ~3 min from the stub.
    await expect(launcher.locator(".next-up__meta")).toContainText("3");
    await expect(launcher.locator(".next-up__meta")).toContainText("2");
    await expect(launcher.getByRole("link", { name: /начать практику/ })).toHaveAttribute(
      "href",
      "/cards/session?scope=practice",
    );
  });
});

test.describe("атлас — добавить подпаттерн в практику", () => {
  test("hero toggle reflects state and posts the change", async ({ page }) => {
    await openAuthed(page, "/patterns/binary_search_on_answer");

    // Already in the stub practice set → active state.
    const toggle = page.getByRole("button", { name: /в практике/ });
    await expect(toggle).toBeVisible();

    // Toggling off fires DELETE, label flips to "add".
    const del = page.waitForRequest(
      (request) =>
        request.method() === "DELETE" &&
        request.url().includes("/me/practice/subpatterns/binary_search_on_answer"),
    );
    await toggle.click();
    await del;
    const addButton = page.getByRole("button", { name: /добавить в практику/ });
    await expect(addButton).toBeVisible();

    // Toggling back on posts the code.
    const post = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().includes("/me/practice/subpatterns"),
    );
    await addButton.click();
    const request = await post;
    expect(request.postDataJSON()).toMatchObject({ code: "binary_search_on_answer" });
    await expect(page.getByRole("button", { name: /в практике/ })).toBeVisible();
  });
});
