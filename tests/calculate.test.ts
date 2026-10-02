import { describe, expect, it } from "vitest";
import {
  calculateInvoiceTotals,
  clampTaxRate,
  extractInclusiveTax,
  isGstActive,
  lineTotalsFor,
  resolveDiscountMinor,
  roundOffMinor,
  splitGst,
} from "@/lib/invoice/calculate";
import { createEmptyInvoice, createEmptyItem } from "@/lib/invoice/defaults";
import { QTY_SCALE, rupeesToMinor, scaleQuantity } from "@/lib/money";
import type { Invoice, InvoiceItem } from "@/types/invoice";

const R = rupeesToMinor;

function item(overrides: Partial<InvoiceItem> & { rate: number; qty: number }): InvoiceItem {
  const { rate, qty, ...rest } = overrides;
  return createEmptyItem({
    ...rest,
    rateMinor: R(rate),
    quantity: scaleQuantity(qty),
  });
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return { ...createEmptyInvoice(), ...overrides };
}

describe("resolveDiscountMinor", () => {
  it("returns zero for none", () => {
    expect(resolveDiscountMinor("none", 500, 10_000)).toBe(0);
  });

  it("applies a percent discount to the base", () => {
    expect(resolveDiscountMinor("percent", 10, 10_000)).toBe(1000);
    expect(resolveDiscountMinor("percent", 18, 10_000)).toBe(1800);
  });

  it("applies an amount discount directly", () => {
    expect(resolveDiscountMinor("amount", 250, 10_000)).toBe(250);
  });

  it("never discounts below zero", () => {
    expect(resolveDiscountMinor("amount", 99_999, 10_000)).toBe(10_000);
    expect(resolveDiscountMinor("percent", 150, 10_000)).toBe(10_000);
  });
});

describe("extractInclusiveTax", () => {
  it("extracts tax from a GST-inclusive price", () => {
    // 1188.00 inclusive of 18% => 1006.78 taxable + 181.22 tax.
    const { taxableMinor, taxMinor } = extractInclusiveTax(R(1188), 18);
    expect(taxableMinor).toBe(100_678);
    expect(taxableMinor + taxMinor).toBe(118_800);
  });

  it("handles a zero rate", () => {
    const { taxableMinor, taxMinor } = extractInclusiveTax(10_000, 0);
    expect(taxableMinor).toBe(10_000);
    expect(taxMinor).toBe(0);
  });
});

describe("splitGst", () => {
  it("splits intra-state tax evenly into CGST and SGST", () => {
    const { cgstMinor, sgstMinor, igstMinor } = splitGst(1800, "intra");
    expect(cgstMinor).toBe(900);
    expect(sgstMinor).toBe(900);
    expect(igstMinor).toBe(0);
  });

  it("keeps the whole amount as IGST for inter-state", () => {
    const { cgstMinor, sgstMinor, igstMinor } = splitGst(1800, "inter");
    expect(cgstMinor).toBe(0);
    expect(sgstMinor).toBe(0);
    expect(igstMinor).toBe(1800);
  });

  it("keeps odd paise exact rather than losing one", () => {
    const { cgstMinor, sgstMinor } = splitGst(1, "intra");
    expect(cgstMinor + sgstMinor).toBe(1);
  });
});

describe("roundOffMinor", () => {
  it("reports the signed delta needed to reach a whole rupee", () => {
    // Rs 1,234.56 rounds UP to Rs 1,235, so the delta is +44 paise.
    expect(roundOffMinor(123_456)).toBe(44);
    // Rs 1,234.44 rounds DOWN to Rs 1,234, so the delta is -44 paise.
    expect(roundOffMinor(123_444)).toBe(-44);
    expect(roundOffMinor(123_400)).toBe(0);
  });

  it("always lands exactly on a whole rupee", () => {
    for (const paise of [1, 49, 50, 51, 99, 123_456, 999_999]) {
      expect((paise + roundOffMinor(paise)) % 100).toBe(0);
    }
  });
});

describe("isGstActive / clampTaxRate", () => {
  it("is active only in gst mode", () => {
    expect(isGstActive(invoice({ taxMode: "gst" }))).toBe(true);
    expect(isGstActive(invoice({ taxMode: "none" }))).toBe(false);
  });

  it("clamps tax rates into 0-100", () => {
    expect(clampTaxRate(-5)).toBe(0);
    expect(clampTaxRate(18)).toBe(18);
    expect(clampTaxRate(150)).toBe(100);
    expect(clampTaxRate(Number.NaN)).toBe(0);
  });
});

describe("calculateInvoiceTotals", () => {
  it("computes a single exclusive-tax line", () => {
    // 2 x Rs 1,000 at 18% GST, exclusive.
    const totals = calculateInvoiceTotals(
      invoice({
        taxMode: "gst",
        gstScope: "intra",
        items: [item({ description: "Design", qty: 2, rate: 1000, taxRate: 18 })],
      }),
    );

    expect(totals.subtotalMinor).toBe(200_000);
    expect(totals.lineDiscountMinor).toBe(0);
    expect(totals.taxableMinor).toBe(200_000);
    expect(totals.cgstMinor).toBe(18_000);
    expect(totals.sgstMinor).toBe(18_000);
    expect(totals.igstMinor).toBe(0);
    expect(totals.taxMinor).toBe(36_000);
    expect(totals.grandTotalMinor).toBe(236_000);
  });

  it("guards the double-scaling regression on quantity", () => {
    // A stored quantity of 1000 means ONE unit. If the calculator scaled it
    // again, the line would be 1000x too large.
    const totals = calculateInvoiceTotals(
      invoice({
        taxMode: "none",
        items: [{ ...createEmptyItem({ description: "One" }), rateMinor: R(1000), quantity: QTY_SCALE }],
      }),
    );
    expect(totals.subtotalMinor).toBe(100_000);
    expect(totals.grandTotalMinor).toBe(100_000);
  });

  it("keeps fractional quantities exact", () => {
    // 1.5 x Rs 999.99 = Rs 1,499.99
    const totals = calculateInvoiceTotals(
      invoice({
        taxMode: "none",
        items: [item({ description: "Half day", qty: 1.5, rate: 999.99, taxRate: 0 })],
      }),
    );
    expect(totals.subtotalMinor).toBe(149_999);
  });

  it("applies inclusive GST by extracting tax from the price", () => {
    // 1 x Rs 1,188 inclusive of 18% => 1,006.78 taxable, 181.22 tax.
    const totals = calculateInvoiceTotals(
      invoice({
        taxMode: "gst",
        gstScope: "inter",
        pricesIncludeTax: true,
        items: [item({ description: "Inclusive", qty: 1, rate: 1188, taxRate: 18 })],
      }),
    );
    expect(totals.taxableMinor).toBe(100_678);
    expect(totals.igstMinor).toBe(18_122);
    expect(totals.grandTotalMinor).toBe(118_800);
  });

  it("applies a line discount before tax on an exclusive price", () => {
    // 1 x Rs 1,000, 10% off => 900 taxable, +18% = 162 tax => 1,062.
    const totals = calculateInvoiceTotals(
      invoice({
        taxMode: "gst",
        gstScope: "intra",
        items: [
          item({ description: "Discounted", qty: 1, rate: 1000, taxRate: 18, discountType: "percent", discountValue: 10 }),
        ],
      }),
    );
    expect(totals.lineDiscountMinor).toBe(10_000);
    expect(totals.taxableMinor).toBe(90_000);
    expect(totals.taxMinor).toBe(16_200);
    expect(totals.grandTotalMinor).toBe(106_200);
  });

  it("applies the global discount after line discounts", () => {
    // Two 1,000 lines, no line discount, then 10% off the 2,000 subtotal.
    const totals = calculateInvoiceTotals(
      invoice({
        taxMode: "gst",
        gstScope: "intra",
        globalDiscountType: "percent",
        globalDiscountValue: 10,
        items: [
          item({ description: "A", qty: 1, rate: 1000, taxRate: 18 }),
          item({ description: "B", qty: 1, rate: 1000, taxRate: 18 }),
        ],
      }),
    );
    expect(totals.subtotalMinor).toBe(200_000);
    expect(totals.globalDiscountMinor).toBe(20_000);
    expect(totals.taxableMinor).toBe(180_000);
    expect(totals.taxMinor).toBe(32_400);
    expect(totals.grandTotalMinor).toBe(212_400);
  });

  it("adds shipping after tax and applies round-off last", () => {
    const totals = calculateInvoiceTotals(
      invoice({
        taxMode: "gst",
        gstScope: "intra",
        shippingMinor: 5_000,
        roundOffEnabled: true,
        items: [item({ description: "A", qty: 1, rate: 1000, taxRate: 18 })],
      }),
    );
    expect(totals.shippingMinor).toBe(5_000);
    // 1,000 + 180 + 50 = 1,230.00 exactly, so round-off is zero.
    expect(totals.roundOffMinor).toBe(0);
    expect(totals.grandTotalMinor).toBe(123_000);
  });

  it("produces a zero invoice without NaN", () => {
    const totals = calculateInvoiceTotals(
      invoice({ taxMode: "gst", items: [item({ description: "Free", qty: 1, rate: 0, taxRate: 18 })] }),
    );
    expect(totals.grandTotalMinor).toBe(0);
    expect(Number.isFinite(totals.grandTotalMinor)).toBe(true);
  });

  it("reconciles to the rupee once round-off is on", () => {
    const totals = calculateInvoiceTotals(
      invoice({
        taxMode: "gst",
        gstScope: "intra",
        roundOffEnabled: true,
        items: [item({ description: "Odd", qty: 3, rate: 333.33, taxRate: 5 })],
      }),
    );
    expect(totals.grandTotalMinor % 100).toBe(0);
  });

  it("groups tax into rate buckets that sum to the total tax", () => {
    const totals = calculateInvoiceTotals(
      invoice({
        taxMode: "gst",
        gstScope: "intra",
        items: [
          item({ description: "18%", qty: 1, rate: 1000, taxRate: 18 }),
          item({ description: "12%", qty: 1, rate: 1000, taxRate: 12 }),
          item({ description: "nil", qty: 1, rate: 500, taxRate: 0 }),
        ],
      }),
    );

    // A bucket carries the split components, so sum them to recover the tax.
    const bucketTax = totals.buckets.reduce(
      (sum, b) => sum + b.cgstMinor + b.sgstMinor + b.igstMinor,
      0,
    );
    expect(bucketTax).toBe(totals.taxMinor);
    expect(totals.taxMinor).toBe(30_000);
    // Nil-rated lines are excluded from the GST summary: they carry no tax.
    expect(totals.buckets.map((b) => b.rate)).toEqual([12, 18]);
    expect(totals.buckets.map((b) => b.taxableMinor)).toEqual([100_000, 100_000]);
    // Buckets are always ordered by rate regardless of line order.
    // 250,000 taxable across three lines + 30,000 tax.
    expect(totals.subtotalMinor).toBe(250_000);
    expect(totals.grandTotalMinor).toBe(280_000);
  });

  it("ignores tax entirely when taxMode is none", () => {
    const totals = calculateInvoiceTotals(
      invoice({
        taxMode: "none",
        items: [item({ description: "No tax", qty: 1, rate: 1000, taxRate: 18 })],
      }),
    );
    expect(totals.taxMinor).toBe(0);
    expect(totals.cgstMinor).toBe(0);
    expect(totals.grandTotalMinor).toBe(100_000);
  });
});

describe("lineTotalsFor", () => {
  it("returns the totals for a specific line id", () => {
    const a = item({ description: "A", qty: 1, rate: 1000, taxRate: 18 });
    const b = item({ description: "B", qty: 2, rate: 500, taxRate: 18 });
    const totals = calculateInvoiceTotals(invoice({ taxMode: "gst", gstScope: "intra", items: [a, b] }));

    const lineA = lineTotalsFor(totals, a.id);
    expect(lineA?.taxableMinor).toBe(100_000);
    expect(lineA?.totalMinor).toBe(118_000);
  });

  it("returns undefined for an unknown line id", () => {
    const a = item({ description: "A", qty: 1, rate: 1000, taxRate: 0 });
    const totals = calculateInvoiceTotals(invoice({ items: [a] }));
    expect(lineTotalsFor(totals, "does-not-exist")).toBeUndefined();
  });
});

describe("advance paid", () => {
  it("defaults to no advance, so the balance equals the grand total", () => {
    const totals = calculateInvoiceTotals(invoice({ items: [item({ qty: 1, rate: 1000, taxRate: 0 })] }));

    expect(totals.grandTotalMinor).toBe(100_000);
    expect(totals.advanceMinor).toBe(0);
    expect(totals.balanceDueMinor).toBe(100_000);
  });

  it("deducts the advance from the total while leaving the total intact", () => {
    const totals = calculateInvoiceTotals(
      invoice({ items: [item({ qty: 1, rate: 1000, taxRate: 0 })], advanceMinor: 25_000 }),
    );

    expect(totals.grandTotalMinor).toBe(100_000);
    expect(totals.advanceMinor).toBe(25_000);
    expect(totals.balanceDueMinor).toBe(75_000);
  });

  it("settles the invoice to a zero balance when the advance covers it", () => {
    const totals = calculateInvoiceTotals(
      invoice({ items: [item({ qty: 1, rate: 1000, taxRate: 0 })], advanceMinor: 100_000 }),
    );

    expect(totals.balanceDueMinor).toBe(0);
  });

  it("caps an over-payment at the total rather than going negative", () => {
    const totals = calculateInvoiceTotals(
      invoice({ items: [item({ qty: 1, rate: 1000, taxRate: 0 })], advanceMinor: 500_000 }),
    );

    expect(totals.advanceMinor).toBe(100_000);
    expect(totals.balanceDueMinor).toBe(0);
  });

  it("ignores a negative advance", () => {
    const totals = calculateInvoiceTotals(
      invoice({ items: [item({ qty: 1, rate: 1000, taxRate: 0 })], advanceMinor: -5_000 }),
    );

    expect(totals.advanceMinor).toBe(0);
    expect(totals.balanceDueMinor).toBe(100_000);
  });

  it("caps against the rounded grand total, not the unrounded one", () => {
    const totals = calculateInvoiceTotals(
      invoice({
        items: [item({ qty: 3, rate: 333.33, taxRate: 0 })],
        roundOffEnabled: true,
        advanceMinor: 100_000,
      }),
    );

    expect(totals.grandTotalMinor).toBe(100_000);
    expect(totals.balanceDueMinor).toBe(0);
  });
});
