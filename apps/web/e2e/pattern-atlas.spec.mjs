import { expect, test } from "@playwright/test";

// Pattern Atlas UI: taxonomy tree with progressive disclosure, company
// relevance overlay, companies view and the subpattern educational detail.
// Backed by the atlas fixtures in auth-stub.mjs.

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";
const TOUR_KEY = "realgo.cabinet.tour";

// Company selector is a search dialog (button trigger → dialog with a list
// of option buttons), not a native <select> — pick by visible name, or pass
// "" to reset via the "— без компании —" option.
async function selectCompany(page, name) {
  await page.locator(".atlas-company__trigger").click();
  const dialog = page.locator(".shell-dialog--company");
  await expect(dialog).toBeVisible();
  const optionName = name || "— без компании —";
  await dialog.getByRole("option", { name: optionName, exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function openAtlas(page, { token = "LIVE" } = {}) {
  await page.goto("/patterns");
  await page.evaluate(
    ([a, r, tourKey, kind]) => {
      localStorage.setItem(a, `${kind}.access`);
      localStorage.setItem(r, `${kind}.refresh`);
      localStorage.setItem(tourKey, "done");
      localStorage.removeItem("realgo.atlas.company");
      localStorage.removeItem("realgo.atlas.view");
      localStorage.removeItem("realgo.atlas.expanded");
    },
    [AKEY, RKEY, TOUR_KEY, token],
  );
  await page.goto("/patterns");
}

test.describe("pattern atlas tree", () => {
  test("renders taxonomy, expand/collapse works and persists", async ({ page }) => {
    await openAtlas(page);

    await expect(page.locator(".atlas-tree")).toBeVisible();
    await expect(page.getByText("Binary Search", { exact: true })).toBeVisible();
    await expect(page.getByText("задачи по сложности", { exact: true })).toBeVisible();
    await expect(page.getByText("подпаттерны", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "развернуть всё" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "свернуть всё" })).toHaveCount(0);
    await expect(page.locator(".atlas-tree.atlas-table")).toHaveCount(0);
    const binaryFamily = page.locator(".atlas-family", { hasText: "Binary Search" });
    await expect(binaryFamily.locator(".atlas-difficulty-badge")).toHaveText(["easy 5", "medium 8", "hard 3"]);

    // Progressive disclosure: subpatterns hidden until expanded.
    await expect(page.locator(".atlas-sub:visible")).toHaveCount(0);
    await page.getByRole("button", { name: /Binary Search$/ }).click();
    await expect(page).toHaveURL(/\/patterns$/);
    await expect(page.getByText("Binary Search on Answer")).toBeVisible();
    await expect(page.locator(".atlas-sub:visible")).toHaveCount(2);
    const answerSub = page.locator(".atlas-sub", { hasText: "Binary Search on Answer" });
    await expect(answerSub.locator(".atlas-difficulty-badge")).toHaveText(["easy 3", "medium 6", "hard 3"]);
    const boundsSub = page.locator(".atlas-sub", { hasText: "Lower / Upper Bound" });
    await expect(boundsSub.locator(".atlas-difficulty-badge")).toHaveText(["easy 2", "medium 2"]);
    // The family name itself links to the pattern profile page.
    await expect(page.locator('a[href="/patterns/binary_search"]')).toBeVisible();
    await expect(page.locator('a[href="/patterns/binary_search_on_answer"]')).toBeVisible();

    // Mastery state is text, not colour alone.
    await expect(page.locator(".atlas-status--unstable")).toContainText("нестабильный");

    // Collapse hides the branch again.
    await page.getByRole("button", { name: /Binary Search$/ }).click();
    await expect(page.locator(".atlas-sub:visible")).toHaveCount(0);

    // Expansion state survives a reload.
    await page.getByRole("button", { name: /Binary Search$/ }).click();
    await page.reload();
    await expect(page.locator(".atlas-sub:visible")).toHaveCount(2);
  });

  test("search filters subpatterns", async ({ page }) => {
    await openAtlas(page);
    await expect(page.locator(".atlas-tree")).toBeVisible();

    await page.fill(".atlas-search", "window");
    await expect(page.getByText("Fixed-Size Window")).toBeVisible();
    await expect(page.getByText("Binary Search on Answer")).toHaveCount(0);

    await page.fill(".atlas-search", "zzz-none");
    await expect(page.locator(".atlas-tree")).toHaveCount(0);
  });

  test("company overlay adds relevance badges and demo note", async ({ page }) => {
    await openAtlas(page);
    await expect(page.locator(".atlas-tree")).toBeVisible();

    // Выбор компании сразу переключает на companies view — этот тест
    // проверяет relevance-бейджи в дереве, поэтому возвращаемся на Tree.
    await selectCompany(page, "Stub Corp");
    await page.getByRole("tab", { name: "Tree" }).click();
    await expect(page.locator(".atlas-demo-note")).toBeVisible();

    await page.getByRole("button", { name: /Binary Search$/ }).click();
    await expect(page.locator(".atlas-relevance--high")).toBeVisible();

    // No relevance marker on nodes without evidence.
    await page.getByRole("button", { name: /Sliding Window$/ }).click();
    const windowRow = page.locator(".atlas-sub", { hasText: "Fixed-Size Window" });
    await expect(windowRow.locator(".atlas-relevance")).toHaveCount(0);
  });

  test("companies view is locked without a company and shows coverage with one", async ({ page }) => {
    await openAtlas(page);
    await expect(page.locator(".atlas-tree")).toBeVisible();

    // Without a company the companies mode is disabled.
    const companiesTab = page.locator(".atlas-view-toggle button:nth-child(2)");
    await expect(companiesTab).toBeDisabled();

    // Выбор компании сразу переключает на companies view — отдельный клик
    // по табу не нужен, но тест всё равно проверяет, что таб включился.
    await selectCompany(page, "Stub Corp");
    await expect(companiesTab).toBeEnabled();
    await expect(page.locator(".atlas-coverage")).toBeVisible();
    await expect(page.locator(".atlas-gaps li")).toHaveCount(1);
    await expect(page.locator(".atlas-gaps")).toContainText("Binary Search on Answer");

    // Сброс компании возвращает дерево и снова блокирует companies view.
    await selectCompany(page, "");
    await expect(page.locator(".atlas-tree")).toBeVisible();
    await expect(companiesTab).toBeDisabled();
  });

  test("API failure shows error state with retry", async ({ page }) => {
    await openAtlas(page, { token: "FLAKY" });
    await expect(page.getByText("Не удалось загрузить атлас")).toBeVisible();
    await expect(page.getByRole("button", { name: "повторить" })).toBeVisible();
  });
});

test.describe("subpattern detail", () => {
  test("renders the profile canvas with methodology and problem cards", async ({ page }) => {
    await openAtlas(page);
    await page.goto("/patterns/binary_search_on_answer");

    // Same black profile canvas as the family page.
    await expect(page.locator(".pattern-profile h1")).toContainText("Binary Search on Answer");
    await expect(page.locator(".cabinet-page--pattern")).toBeVisible();
    await expect(page.locator(".pattern-profile")).toContainText("поиск по пространству ответов");
    await expect(page.locator(".atlas-skeleton")).toContainText("while lo < hi");
    await expect(page.locator(".atlas-contrast")).toContainText("Exact Binary Search");

    // Hero CTA invites to practice cards for this subpattern.
    const cta = page.locator('a.pattern-profile__cta[href="/patterns/binary_search_on_answer/session"]');
    await expect(cta).toBeVisible();
    await expect(cta).toContainText("Карточки для тренировки");

    // Catalog-wide difficulty distribution of the practice set in the hero.
    await expect(page.locator(".pattern-profile__mastery", { hasText: "difficulty" })).toContainText(
      "easy 2 · medium 7 · hard 3",
    );

    // Problem cards: index, external link and the interviewing company.
    const problem = page.locator(".pattern-profile__subs a", { hasText: "Koko Eating Bananas" });
    await expect(problem).toBeVisible();
    await expect(problem).toHaveAttribute("href", /koko/);
    await expect(problem).toContainText("01");
    await expect(problem).toContainText("core");
    await expect(problem).toContainText("Stub Corp");
  });

  test("not-studied subpattern shows preparing/empty states", async ({ page }) => {
    await openAtlas(page);
    await page.goto("/patterns/fixed_size_window");

    await expect(page.locator("h1")).toContainText("Fixed-Size Window");
    await expect(page.getByText("Методический материал готовится")).toBeVisible();
    await expect(page.getByText("К этому субпаттерну задачи ещё не привязаны.")).toBeVisible();
  });

  test("family page renders the pattern profile", async ({ page }) => {
    await openAtlas(page);
    await page.goto("/patterns/binary_search");

    await expect(page.locator(".pattern-profile h1")).toContainText("Binary Search");
    await expect(page.getByText("Что это", { exact: true })).toBeVisible();
    await expect(page.getByText("Когда не подходит", { exact: true })).toBeVisible();

    // Methodology copy from pattern-profiles.ts fills the sections.
    await expect(page.getByText("Сокращает пространство поиска примерно вдвое")).toBeVisible();
    await expect(page.locator(".pattern-profile__pending")).toHaveCount(0);

    // Subpatterns come from the API, link to their own pages and carry
    // the one-line differentiation note keyed by subpattern code.
    const subLink = page.locator('a[href="/patterns/binary_search_on_answer"]');
    await expect(subLink).toBeVisible();
    await expect(subLink).toContainText("Binary Search on Answer");
    await expect(subLink).toContainText("монотонный предикат");
  });

  test("unknown node shows not-found state", async ({ page }) => {
    await openAtlas(page);
    await page.goto("/patterns/nope_no_such_node");
    await expect(page.getByText("Такого узла в атласе нет").first()).toBeVisible();
  });
});
