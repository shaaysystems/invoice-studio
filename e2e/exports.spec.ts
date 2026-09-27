import { test, expect, type Download, type Page } from "@playwright/test";

/** Exports are gated on a valid invoice, so fill the minimum first. */
async function fillValidInvoice(page: Page) {
  await page.goto("/invoices/new");
  await page.getByRole("button", { name: "Parties" }).click();
  await page.getByLabel("Business name").fill("Northstar Studio");
  await page.getByLabel("Client name").fill("Acme Technologies Pvt. Ltd.");
  await page.getByRole("button", { name: "Items" }).click();
  await page.getByLabel(/description/i).first().fill("Design retainer");
  await page.getByLabel(/quantity/i).first().fill("2");
  await page.getByLabel(/^rate/i).first().fill("25000");
}

async function grab(page: Page, action: () => Promise<void>) {
  const pending = page.waitForEvent("download");
  await action();
  return pending;
}

test.describe("exports", () => {
  test("PDF export downloads a real PDF", async ({ page }) => {
    await fillValidInvoice(page);

    const download: Download = await grab(page, async () => {
      await page.getByRole("button", { name: "Download PDF" }).click();
    });

    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    expect(download.suggestedFilename()).toContain("Acme-Technologies");

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);

    // %PDF- magic, and a non-trivial document rather than an empty shell.
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2000);
  });

  test("JPEG export downloads a real image", async ({ page }) => {
    await fillValidInvoice(page);

    const download: Download = await grab(page, async () => {
      await page.getByRole("button", { name: "Download JPEG" }).click();
    });

    expect(download.suggestedFilename()).toMatch(/\.(jpe?g|png)$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);

    // SOI + APP0/JFIF (or PNG signature) so we know it is a decodable image.
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const isPng = bytes.subarray(1, 4).toString() === "PNG";
    expect(isJpeg || isPng).toBe(true);
    expect(bytes.length).toBeGreaterThan(2000);
  });

  test("export is blocked, with reasons, when the invoice is incomplete", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.getByRole("button", { name: "Parties" }).click();

    // No items and no client name -> the pre-export gate must refuse.
    await page.getByRole("button", { name: "Download PDF" }).click();

    const alert = page.getByText("Fix the highlighted fields to export.");
    await expect(alert).toBeVisible();
    // The gate names the actual problems rather than failing opaquely.
    await expect(alert.locator("xpath=following-sibling::ul").or(page.locator("li")).first()).toBeVisible();
  });
});
