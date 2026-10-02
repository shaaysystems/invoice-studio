import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdfDocument } from "@/lib/export/pdf-document";
import { calculateInvoiceTotals } from "@/lib/invoice/calculate";
import { createDemoInvoice } from "@/lib/invoice/defaults";
import type { Invoice, InvoiceTotals } from "@/types/invoice";

async function pdfFor(invoice: Invoice): Promise<string> {
  const totals: InvoiceTotals = calculateInvoiceTotals(invoice);
  const buffer = await renderToBuffer(
    InvoicePdfDocument({ invoice, totals, useInter: false }) as never,
  );
  return buffer.toString("latin1");
}

describe("PDF social links", () => {
  it("embeds a URI annotation for every filled profile", async () => {
    const pdf = await pdfFor(createDemoInvoice());

    expect(pdf).toContain("/URI");
    expect(pdf).toContain("https://example.com");
    expect(pdf).toContain("https://instagram.com/example.studio");
    expect(pdf).toContain("https://linkedin.com/example-studio");
    // The demo profile leaves X blank, so no dead link may be emitted for it.
    expect(pdf).not.toContain("https://x.com/");
  });

  it("draws the icon strip only when a link resolves", async () => {
    const invoice = createDemoInvoice();
    const socials = invoice.business.socials;
    const withoutLinks = { ...invoice, business: { ...invoice.business, socials: { ...socials, website: "", instagram: "instagram.com", linkedin: "", twitter: "" } } };

    const withIcons = await pdfFor(invoice);
    const withoutIcons = await pdfFor(withoutLinks);

    // Icon geometry is written as vector operators, so the glyph count shows up
    // as a difference in the content stream.
    expect(withIcons.length).toBeGreaterThan(withoutIcons.length);
    expect(withoutIcons).not.toContain("/URI");
  });
});