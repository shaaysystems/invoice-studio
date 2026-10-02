import { test, expect, type Page } from "@playwright/test";

const ALL_PROFILES = {
  Website: "example.com",
  Instagram: "@example.studio",
  "X / Twitter": "@example",
} as const;

/** Fills the minimum valid invoice, plus whichever profiles are passed in. */
async function fillInvoice(page: Page, profiles: Record<string, string>) {
  await page.goto("/invoices/new");
  await page.getByRole("button", { name: "Parties" }).click();
  await page.getByLabel("Business name").fill("Northstar Studio");
  await page.getByLabel("Client name").fill("Acme Technologies Pvt. Ltd.");

  const labels = Object.keys(profiles);
  if (labels.length) {
    await page.getByRole("button", { name: "Social links" }).click();
    for (const [label, value] of Object.entries(profiles)) {
      await page.getByLabel(label).fill(value);
    }
  }

  await page.getByRole("button", { name: "Items" }).click();
  await page.getByLabel(/description/i).first().fill("Design retainer");
  await page.getByLabel(/quantity/i).first().fill("2");
  await page.getByLabel(/^rate/i).first().fill("25000");
}

/** Each profile is printed twice per page: small in the From block, larger in the footer. */
const inlineIcons = (page: Page) => page.locator('#invoice-export-root [data-social-row="inline"] a[target="_blank"]');
const footerIcons = (page: Page) => page.locator('#invoice-export-root [data-social-row="footer"] a[target="_blank"]');
const iconLinks = (page: Page) => page.locator('#invoice-export-root a[target="_blank"]');

test.describe("social links", () => {
  test("prints each profile as an icon that resolves to its URL", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await fillInvoice(page, ALL_PROFILES);

    // Three filled profiles means three icons in each of the two places, and
    // nothing at all for the blank LinkedIn field.
    await expect(inlineIcons(page)).toHaveCount(3);
    await expect(footerIcons(page)).toHaveCount(3);
    await expect(inlineIcons(page).nth(0)).toHaveAttribute("href", "https://example.com");
    await expect(inlineIcons(page).nth(1)).toHaveAttribute("href", "https://instagram.com/example.studio");
    await expect(inlineIcons(page).nth(2)).toHaveAttribute("href", "https://x.com/example");
    await expect(inlineIcons(page).nth(0).locator("svg")).toHaveCount(1);

    // The footer copy is the larger of the two, and sits on the right.
    const inlineBox = await inlineIcons(page).nth(0).boundingBox();
    const footerBox = await footerIcons(page).nth(0).boundingBox();
    expect(footerBox!.width).toBeGreaterThan(inlineBox!.width * 1.5);
    const pageBox = (await page.locator("#invoice-export-root").boundingBox())!;
    expect(footerBox!.x + footerBox!.width).toBeGreaterThan(pageBox.x + pageBox.width * 0.6);

    // The icons replace the old printed link line, so the raw handles and the
    // network names must not appear as text anywhere in the document.
    const documentText = await page.locator("#invoice-export-root").innerText();
    for (const printed of ["example.studio", "@example", "Instagram", "X / Twitter", "Website"]) {
      expect(documentText).not.toContain(printed);
    }

    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const stream = await (await pending).createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("latin1");

    // One link annotation per icon is what makes the icons clickable in the PDF.
    expect((raw.match(/\/Subtype \/Link/g) ?? []).length).toBe(6);
    expect(raw).toContain("https://instagram.com/example.studio");
    expect(raw).toContain("https://x.com/example");
    expect(pageErrors).toEqual([]);
  });

  test("adds no icon row when no profile is filled in", async ({ page }) => {
    await fillInvoice(page, {});
    await expect(iconLinks(page)).toHaveCount(0);
  });

  test("drops a profile whose value resolves nowhere", async ({ page }) => {
    await fillInvoice(page, { Website: "example.com", Instagram: "instagram.com" });
    // "instagram.com" alone is not a profile, so only the website earns an icon,
    // in each of the two places.
    await expect(inlineIcons(page)).toHaveCount(1);
    await expect(footerIcons(page)).toHaveCount(1);
  });
});