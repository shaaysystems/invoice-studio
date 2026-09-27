import { test, expect } from "@playwright/test";

test.describe("pagination harness", () => {
  test("renders multiple A4 pages", async ({ page }) => {
    await page.goto("/dev/long-invoice");
    await expect(page.getByTestId("harness-title")).toBeVisible();

    const pages = page.locator("[data-invoice-page]");
    await expect(pages.first()).toBeVisible();
    expect(await pages.count()).toBeGreaterThan(1);
  });

  test("each page keeps A4 proportions", async ({ page }) => {
    await page.goto("/dev/long-invoice");
    const first = page.locator("[data-invoice-page]").first();
    const box = await first.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height / box.width).toBeGreaterThan(1.38);
      expect(box.height / box.width).toBeLessThan(1.44);
    }
  });

  test("the totals block appears once, on the final page", async ({ page }) => {
    await page.goto("/dev/long-invoice");
    await expect(page.locator("[data-totals-block]")).toHaveCount(1);
    const pages = page.locator("[data-invoice-page]");
    const last = pages.nth((await pages.count()) - 1);
    await expect(last.locator("[data-totals-block]")).toHaveCount(1);
  });
});
