import { test, expect } from "@playwright/test";

/** Guest-mode multi-profile flow: the browser copy is the source of truth. */

test.describe("multiple business profiles", () => {
  test("a new invoice offers blank, every saved profile, and demo", async ({ page }) => {
    await page.goto("/dashboard/business");
    await page.getByRole("button", { name: "Add your first profile" }).click();
    await page.getByLabel("Business name").fill("Northstar Studio");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.getByRole("heading", { name: "Northstar Studio" })).toBeVisible();

    await page.goto("/dashboard/business");
    await page.getByRole("button", { name: /add .*business profile/i }).first().click();
    await page.getByLabel("Business name").fill("Acme Consulting");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.getByRole("heading", { name: "Acme Consulting" })).toBeVisible();

    await page.goto("/invoices/new");
    const strip = page.getByRole("button", { name: /^(Blank invoice|Northstar Studio|Acme Consulting|Demo invoice)$/ });
    await expect(strip).toHaveCount(4);
  });

  test("a new invoice prefills from the default profile", async ({ page }) => {
    await page.goto("/dashboard/business");
    await page.getByRole("button", { name: "Add your first profile" }).click();
    await page.getByLabel("Business name").fill("Northstar Studio");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.getByRole("heading", { name: "Northstar Studio" })).toBeVisible();

    await page.goto("/invoices/new");
    await page.getByRole("button", { name: "Parties" }).click();
    await expect(page.getByLabel("Business name")).toHaveValue("Northstar Studio");
  });

  test("choosing another profile fills the sender details in place", async ({ page }) => {
    await page.goto("/dashboard/business");
    await page.getByRole("button", { name: "Add your first profile" }).click();
    await page.getByLabel("Business name").fill("Northstar Studio");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.getByRole("heading", { name: "Northstar Studio" })).toBeVisible();

    await page.goto("/dashboard/business");
    await page.getByRole("button", { name: /add .*business profile/i }).first().click();
    await page.getByLabel("Business name").fill("Acme Consulting");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.getByRole("heading", { name: "Acme Consulting" })).toBeVisible();

    await page.goto("/invoices/new");
    await page.getByRole("button", { name: "Parties" }).click();
    await page.getByLabel("Client name").fill("Client kept across the switch");

    await page.getByRole("button", { name: "Acme Consulting", exact: true }).click();

    await expect(page.getByLabel("Business name")).toHaveValue("Acme Consulting");
    // Line items and the client belong to the document, not the profile.
    await expect(page.getByLabel("Client name")).toHaveValue("Client kept across the switch");
  });

  test("blank invoice ignores the saved profiles", async ({ page }) => {
    await page.goto("/dashboard/business");
    await page.getByRole("button", { name: "Add your first profile" }).click();
    await page.getByLabel("Business name").fill("Northstar Studio");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.getByRole("heading", { name: "Northstar Studio" })).toBeVisible();

    await page.goto("/invoices/new");
    await page.getByRole("button", { name: "Blank invoice" }).click();
    await page.getByRole("button", { name: "Parties" }).click();

    await expect(page.getByLabel("Business name")).toHaveValue("");
  });

  test("deleting a profile removes it from the picker", async ({ page }) => {
    await page.goto("/dashboard/business");
    await page.getByRole("button", { name: "Add your first profile" }).click();
    await page.getByLabel("Business name").fill("Northstar Studio");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.getByRole("heading", { name: "Northstar Studio" })).toBeVisible();

    await page.goto("/invoices/new");
    await expect(page.getByRole("button", { name: "Northstar Studio", exact: true })).toBeVisible();

    await page.goto("/dashboard/business");
    await page.getByRole("button", { name: "Delete this profile" }).click();

    await page.goto("/invoices/new");
    await expect(page.getByRole("button", { name: "Northstar Studio", exact: true })).toHaveCount(0);
  });

  test("the editor loader fills from a profile chosen in the dropdown", async ({ page }) => {
    await page.goto("/dashboard/business");
    await page.getByRole("button", { name: "Add your first profile" }).click();
    await page.getByLabel("Business name").fill("Northstar Studio");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.getByRole("heading", { name: "Northstar Studio" })).toBeVisible();

    await page.goto("/invoices/new");
    await page.getByRole("button", { name: "Blank invoice" }).click();
    await page.getByRole("button", { name: "Parties" }).click();

    await page.getByRole("button", { name: /load these details from a saved business profile/i }).click();
    await page.getByRole("button", { name: "Load this profile" }).click();

    await expect(page.getByLabel("Business name")).toHaveValue("Northstar Studio");
  });
});
