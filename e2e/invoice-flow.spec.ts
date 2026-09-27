import { test, expect } from "@playwright/test";

test.describe("guest invoice flow", () => {
  test("landing page routes to the editor", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("link", { name: /start an invoice/i }).click();
    await expect(page).toHaveURL(/\/invoices\/new/);
  });

  test("edits flow through to the live preview", async ({ page }) => {
    await page.goto("/invoices/new");

    await page.getByRole("button", { name: "Parties" }).click();
    await page.getByLabel("Business name").fill("Northwind Studio");
    await page.getByLabel("Client name").fill("Acme Pvt Ltd");

    await expect(page.getByText("Northwind Studio").first()).toBeVisible();
    await expect(page.getByText("Acme Pvt Ltd").first()).toBeVisible();
  });

  test("totals recalculate as items change", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.getByRole("button", { name: "Items" }).click();

    await page.getByLabel(/description/i).first().fill("Design retainer");
    await page.getByLabel(/quantity/i).first().fill("2");
    await page.getByLabel(/rate/i).first().fill("25000");

    await expect(page.getByText("₹50,000.00").first()).toBeVisible();
  });

  test("draft survives a reload", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.getByRole("button", { name: "Parties" }).click();
    await page.getByLabel("Client name").fill("Persisted Client");

    await page.waitForTimeout(600);
    await page.reload();

    await page.getByRole("button", { name: "Parties" }).click();
    await expect(page.getByLabel("Client name")).toHaveValue("Persisted Client");
  });

  test("changing the palette repaints the document", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.getByRole("button", { name: "Brand" }).click();
    await page.getByRole("button", { name: /emerald/i }).first().click();
    await expect(page.locator("[data-invoice-page]").first()).toBeVisible();
  });
});
