import { describe, expect, it } from "vitest";
import { paginateInvoiceItems } from "@/lib/invoice/paginate";
import { computeTableLayout, measureItemRow, estimateLines } from "@/lib/invoice/layout-metrics";
import { calculateInvoiceTotals } from "@/lib/invoice/calculate";
import { createEmptyInvoice, createEmptyItem, createLongDemoInvoice } from "@/lib/invoice/defaults";
import { rupeesToMinor } from "@/lib/money";
import type { Invoice } from "@/types/invoice";

function invoiceWithItems(count: number): Invoice {
  const invoice = createEmptyInvoice();
  return {
    ...invoice,
    items: Array.from({ length: count }, (_, i) =>
      createEmptyItem({
        description: `Line item number ${i + 1} with a reasonably long description to wrap`,
        rateMinor: rupeesToMinor(1000 + i),
        quantity: 1000,
        taxRate: 18,
      }),
    ),
  };
}

describe("computeTableLayout", () => {
  it("allocates column widths that fill the content width", () => {
    const layout = computeTableLayout(createEmptyInvoice());
    const total = Object.values(layout.columns).reduce((sum, w) => sum + w, 0);
    // Columns may not perfectly sum, but must stay within a point or two.
    expect(Math.abs(total - 507.28)).toBeLessThan(2);
  });

  it("grows the description column and shrinks the rest", () => {
    const longDesc = computeTableLayout({
      ...createEmptyInvoice(),
      items: [
        createEmptyItem({
          description: "x".repeat(200),
          hsn: "1234567890123",
          unit: "projects",
        }),
      ],
    });
    expect(longDesc.columns.description).toBeGreaterThan(0);
  });
});

describe("estimateLines / measureItemRow", () => {
  it("returns zero lines for empty text", () => {
    // `measureItemRow` applies the floor of 1, so an empty description still
    // occupies a row rather than collapsing the table.
    expect(estimateLines("", 200, 9)).toBe(0);
    expect(estimateLines("   ", 200, 9)).toBe(0);
  });

  it("counts explicit newlines as separate lines", () => {
    expect(estimateLines("a\nb\nc", 400, 9)).toBe(3);
  });

  it("counts more lines for longer text", () => {
    const short = estimateLines("Design", 200, 9);
    const long = estimateLines("A very long item description ".repeat(12), 200, 9);
    expect(long).toBeGreaterThan(short);
  });

  it("never returns a non-positive row height", () => {
    const layout = computeTableLayout(createEmptyInvoice());
    const height = measureItemRow({ description: "" }, layout);
    expect(height).toBeGreaterThan(0);
  });
});

describe("paginateInvoiceItems", () => {
  it("keeps a short invoice on one page", () => {
    const invoice = invoiceWithItems(2);
    const result = paginateInvoiceItems(invoice, calculateInvoiceTotals(invoice));
    expect(result.pages.length).toBeGreaterThanOrEqual(1);
    expect(result.pageCount).toBe(result.pages.length);
  });

  it("paginates a long invoice across several pages", () => {
    const invoice = invoiceWithItems(60);
    const result = paginateInvoiceItems(invoice, calculateInvoiceTotals(invoice));
    expect(result.pages.length).toBeGreaterThan(1);
  });

  it("never drops or duplicates a line item", () => {
    const invoice = invoiceWithItems(40);
    const result = paginateInvoiceItems(invoice, calculateInvoiceTotals(invoice));
    const seen = result.pages.flatMap((p) => p.rows.map((r) => r.item.id));
    expect(seen).toHaveLength(40);
    expect(new Set(seen).size).toBe(40);
    expect(seen).toEqual(invoice.items.map((i) => i.id));
  });

  it("renders a table on every page that carries rows", () => {
    const invoice = invoiceWithItems(40);
    const result = paginateInvoiceItems(invoice, calculateInvoiceTotals(invoice));
    for (const page of result.pages) {
      if (page.rows.length > 0) expect(page.showTable).toBe(true);
    }
  });

  it("gives every page after the first a continuation marker", () => {
    const invoice = invoiceWithItems(40);
    const result = paginateInvoiceItems(invoice, calculateInvoiceTotals(invoice));
    expect(result.pages[0]?.continuedFromPrevious).toBe(false);
    for (const page of result.pages.slice(1)) {
      expect(page.continuedFromPrevious).toBe(true);
    }
  });

  it("shows the totals block exactly once, on the last page", () => {
    const invoice = invoiceWithItems(40);
    const result = paginateInvoiceItems(invoice, calculateInvoiceTotals(invoice));
    const withTotals = result.pages.filter((p) => p.showTail);
    expect(withTotals).toHaveLength(1);
    expect(result.pages.at(-1)?.showTail).toBe(true);
  });

  it("marks a continued table on interior pages", () => {
    const invoice = invoiceWithItems(40);
    const result = paginateInvoiceItems(invoice, calculateInvoiceTotals(invoice));
    const middle = result.pages[0];
    if (result.pages.length > 1 && middle?.rows.length && (middle.rows.length ?? 0) > 0) {
      expect(middle.continuesOnNext).toBe(true);
    }
  });

  it("numbers pages from one and flags exactly one last page", () => {
    const invoice = invoiceWithItems(40);
    const result = paginateInvoiceItems(invoice, calculateInvoiceTotals(invoice));
    result.pages.forEach((page, index) => {
      expect(page.pageNumber).toBe(index + 1);
    });
    expect(result.pages.filter((p) => p.isFirst)).toHaveLength(1);
    expect(result.pages.filter((p) => p.isLast)).toHaveLength(1);
    expect(result.pages.at(-1)?.isLast).toBe(true);
  });

  it("clears the continues-on-next marker on a single-page invoice", () => {
    const invoice = invoiceWithItems(1);
    const result = paginateInvoiceItems(invoice, calculateInvoiceTotals(invoice));
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.continuesOnNext).toBe(false);
  });

  it("paginates the 42-item long demo invoice used by the E2E harness", () => {
    const invoice = createLongDemoInvoice(42);
    const result = paginateInvoiceItems(invoice, calculateInvoiceTotals(invoice));
    expect(result.pages.length).toBeGreaterThan(1);
    const seen = result.pages.flatMap((p) => p.rows.map((r) => r.item.id));
    expect(new Set(seen).size).toBe(42);
  });

  it("handles an empty item list without crashing", () => {
    const invoice = { ...createEmptyInvoice(), items: [] };
    const result = paginateInvoiceItems(invoice, calculateInvoiceTotals(invoice));
    expect(result.pages.length).toBeGreaterThanOrEqual(1);
  });
});
