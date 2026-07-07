import { expect, test } from "@playwright/test";

// Pattern Atlas UI: taxonomy tree with progressive disclosure, company
// relevance overlay, readiness view and the subpattern educational detail.
// Backed by the atlas fixtures in auth-stub.mjs.

const AKEY = "realgo:auth:access:v1";
const RKEY = "realgo:auth:refresh:v1";
const TOUR_KEY = "realgo.cabinet.tour";

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

    // Progressive disclosure: subpatterns hidden until expanded.
    await expect(page.locator(".atlas-sub:visible")).toHaveCount(0);
    await page.getByRole("button", { name: /Binary Search$/ }).click();
    await expect(page).toHaveURL(/\/patterns$/);
    await expect(page.getByText("Binary Search on Answer")).toBeVisible();
    await expect(page.locator(".atlas-sub:visible")).toHaveCount(2);
    await expect(page.locator('a[href="/patterns/binary_search"]')).toHaveCount(0);
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

    await page.selectOption(".atlas-company select", "cmp_stub");
    await expect(page.locator(".atlas-demo-note")).toBeVisible();

    await page.getByRole("button", { name: /Binary Search$/ }).click();
    await expect(page.locator(".atlas-relevance--high")).toBeVisible();

    // No relevance marker on nodes without evidence.
    await page.getByRole("button", { name: /Sliding Window$/ }).click();
    const windowRow = page.locator(".atlas-sub", { hasText: "Fixed-Size Window" });
    await expect(windowRow.locator(".atlas-relevance")).toHaveCount(0);
  });

  test("readiness view is locked without a company and shows coverage with one", async ({ page }) => {
    await openAtlas(page);
    await expect(page.locator(".atlas-tree")).toBeVisible();

    // Without a company the readiness mode is disabled.
    const readinessTab = page.locator(".atlas-view-toggle button:nth-child(2)");
    await expect(readinessTab).toBeDisabled();

    await page.selectOption(".atlas-company select", "cmp_stub");
    await expect(readinessTab).toBeEnabled();
    await readinessTab.click();
    await expect(page.locator(".atlas-coverage")).toBeVisible();
    await expect(page.locator(".atlas-gaps li")).toHaveCount(1);
    await expect(page.locator(".atlas-gaps")).toContainText("Binary Search on Answer");

    // Сброс компании возвращает дерево и снова блокирует readiness.
    await page.selectOption(".atlas-company select", "");
    await expect(page.locator(".atlas-tree")).toBeVisible();
    await expect(readinessTab).toBeDisabled();
  });

  test("API failure shows error state with retry", async ({ page }) => {
    await openAtlas(page, { token: "FLAKY" });
    await expect(page.getByText("Не удалось загрузить атлас")).toBeVisible();
    await expect(page.getByRole("button", { name: "повторить" })).toBeVisible();
  });
});

test.describe("subpattern detail", () => {
  test("shows learn material, practice and companies", async ({ page }) => {
    await openAtlas(page);
    await page.goto("/patterns/binary_search_on_answer");

    await expect(page.locator("h1")).toContainText("Binary Search on Answer");
    await expect(page.locator(".atlas-learn")).toContainText("поиск по пространству ответов");
    await expect(page.locator(".atlas-skeleton")).toContainText("while lo < hi");
    await expect(page.locator(".atlas-contrast")).toContainText("Exact Binary Search");

    // Practice list with tiers and states.
    await expect(page.getByText("Koko Eating Bananas").first()).toBeVisible();
    await expect(page.locator(".atlas-problem").first()).toContainText("core");

    // Company practice grouped by company, marked as demo.
    const companyGroups = page.locator(".atlas-company-groups");
    await expect(companyGroups).toContainText("Stub Corp");
    await expect(companyGroups.locator(".meta-chip--muted").first()).toContainText("demo");

    // Anchor row and the relevant-companies panel are gone.
    await expect(page.locator(".atlas-node-actions a")).toHaveCount(1);
    await expect(page.locator(".atlas-companies")).toHaveCount(0);

    // Cards empty state is honest.
    await expect(page.getByText("Карточек по этому субпаттерну пока нет.")).toBeVisible();
  });

  test("not-studied subpattern shows preparing/empty states", async ({ page }) => {
    await openAtlas(page);
    await page.goto("/patterns/fixed_size_window");

    await expect(page.locator("h1")).toContainText("Fixed-Size Window");
    await expect(page.getByText("Методический материал готовится")).toBeVisible();
    await expect(page.getByText("К этому субпаттерну задачи ещё не привязаны.")).toBeVisible();
    await expect(page.getByText("Задач с привязкой к компаниям для этого субпаттерна пока нет.")).toBeVisible();
  });

  test("family code does not render a standalone pattern page", async ({ page }) => {
    await openAtlas(page);
    await page.goto("/patterns/binary_search");

    await expect(page.getByText("Такого узла в атласе нет").first()).toBeVisible();
    await expect(page.locator(".pattern-profile")).toHaveCount(0);
  });

  test("unknown node shows not-found state", async ({ page }) => {
    await openAtlas(page);
    await page.goto("/patterns/nope_no_such_node");
    await expect(page.getByText("Такого узла в атласе нет").first()).toBeVisible();
  });
});
