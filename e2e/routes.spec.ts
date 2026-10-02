import { test, expect } from "@playwright/test";

/** Every top-level route, checked for a 2xx/3xx and a clean console. */

const ROUTES = [
  "/", "/dashboard", "/dashboard/invoices", "/dashboard/business", "/dashboard/brand",
  "/dashboard/settings", "/invoices/new", "/sign-in", "/sign-up", "/dev/long-invoice",
];

test("every route renders without a server error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
  for (const route of ROUTES) {
    const res = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(res?.status(), `${route} status`).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("new pages show their headings", async ({ page }) => {
  await page.goto("/dashboard/business");
  await expect(page.getByRole("heading", { name: "Business profiles", exact: true })).toBeVisible();
  await page.goto("/dashboard/brand");
  await expect(page.getByRole("heading", { name: "Brand", exact: true })).toBeVisible();
  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("a business profile editor opens from a fresh id", async ({ page }) => {
  await page.goto("/dashboard/business");
  await page.getByRole("button", { name: /add (your first |)business profile/i }).first().click();
  await expect(page.getByRole("heading", { name: "New business profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create profile" })).toBeVisible();
});

test("404 page renders for an unknown route", async ({ page }) => {
  const res = await page.goto("/nope-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("404")).toBeVisible();
});

test("robots and sitemap are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Disallow");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
});
