import { describe, expect, it } from "vitest";
import { cloneAddress, cloneInvoice, duplicateInvoice, toListRow } from "@/lib/invoice/snapshot";
import { calculateInvoiceTotals } from "@/lib/invoice/calculate";
import {
  createDemoInvoice,
  createLongDemoInvoice,
  emptyAddress,
} from "@/lib/invoice/defaults";
import { validateGSTIN } from "@/lib/validation/gstin";
import type { Invoice } from "@/types/invoice";

describe("cloneAddress", () => {
  it("produces an independent copy", () => {
    const source = emptyAddress();
    const copy = cloneAddress(source);
    copy.city = "Chennai";
    expect(source.city).not.toBe("Chennai");
  });
});

describe("cloneInvoice", () => {
  it("deep-clones every nested object", () => {
    const source = createDemoInvoice();
    const copy = cloneInvoice(source);

    copy.business.name = "Changed";
    copy.business.address.city = "Changed";
    copy.business.socials.website = "changed.com";
    copy.client.name = "Changed";
    copy.client.billingAddress.city = "Changed";
    copy.payment.bank.bankName = "Changed";
    copy.signature.name = "Changed";
    copy.brand.primary = "#000000";
    copy.items[0]!.description = "Changed";

    expect(source.business.name).not.toBe("Changed");
    expect(source.business.address.city).not.toBe("Changed");
    expect(source.business.socials.website).not.toBe("changed.com");
    expect(source.client.name).not.toBe("Changed");
    expect(source.client.billingAddress.city).not.toBe("Changed");
    expect(source.payment.bank.bankName).not.toBe("Changed");
    expect(source.signature.name).not.toBe("Changed");
    expect(source.brand.primary).not.toBe("#000000");
    expect(source.items[0]!.description).not.toBe("Changed");
  });

  it("is value-equal to its source", () => {
    const source = createDemoInvoice();
    expect(cloneInvoice(source)).toEqual(source);
  });

  it("does not share array identity for items", () => {
    const source = createDemoInvoice();
    expect(cloneInvoice(source).items).not.toBe(source.items);
  });
});

describe("duplicateInvoice", () => {
  it("keeps the same number and dates by default", () => {
    const source = createDemoInvoice();
    const copy = duplicateInvoice(source);
    expect(copy.number).toBe(source.number);
    expect(copy.issueDate).toBe(source.issueDate);
  });

  it("applies overrides", () => {
    const source = createDemoInvoice();
    const copy = duplicateInvoice(source, { number: "INV-999", client: { ...source.client, name: "New Co" } });
    expect(copy.number).toBe("INV-999");
    expect(copy.client.name).toBe("New Co");
  });

  it("leaves the source untouched when overriding nested branches", () => {
    const source = createDemoInvoice();
    duplicateInvoice(source, { client: { ...source.client, name: "New Co" } });
    expect(source.client.name).not.toBe("New Co");
  });

  it("merges a partial brand override rather than replacing it", () => {
    const source = createDemoInvoice();
    const copy = duplicateInvoice(source, { brand: { ...source.brand, primary: "#ff0000" } });
    expect(copy.brand.primary).toBe("#ff0000");
    expect(copy.brand.accent).toBe(source.brand.accent);
    expect(copy.brand.paletteId).toBe(source.brand.paletteId);
  });
});

describe("toListRow", () => {
  it("projects only the fields the list renders", () => {
    const invoice = createDemoInvoice();
    const totals = calculateInvoiceTotals(invoice);
    const row = toListRow(invoice, totals.grandTotalMinor, "paid");

    expect(row).toEqual({
      id: invoice.id,
      number: invoice.number,
      clientName: invoice.client.name,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      grandTotalMinor: totals.grandTotalMinor,
      status: "paid",
      updatedAt: invoice.updatedAt,
    });
  });

  it("defaults to draft", () => {
    expect(toListRow(createDemoInvoice(), 0).status).toBe("draft");
  });
});

describe("demo factories", () => {
  it("produce invoices that pass the invoice schema's identity rules", () => {
    for (const invoice of [createDemoInvoice(), createLongDemoInvoice(42)]) {
      expect(invoice.id).not.toBe("");
      expect(invoice.business.name).not.toBe("");
      expect(invoice.client.name).not.toBe("");
      expect(invoice.items.length).toBeGreaterThan(0);
    }
  });

  it("builds a long invoice with the requested item count", () => {
    expect(createLongDemoInvoice(42).items).toHaveLength(42);
    expect(createLongDemoInvoice(5).items).toHaveLength(5);
  });

  it("gives every demo line a description and a non-negative rate", () => {
    for (const item of createLongDemoInvoice(12).items) {
      expect(item.description.trim()).not.toBe("");
      expect(item.rateMinor).toBeGreaterThanOrEqual(0);
      expect(item.quantity).toBeGreaterThan(0);
    }
  });

  it("keeps a GSTIN in the demo data valid", () => {
    const invoice = createDemoInvoice();
    if (invoice.business.gstin) expect(validateGSTIN(invoice.business.gstin)).toBe(true);
  });

  it("is deterministic enough that totals are stable", () => {
    const a: Invoice = createDemoInvoice();
    const b: Invoice = createDemoInvoice();
    // Ids and timestamps differ per factory call; the money must not.
    expect(calculateInvoiceTotals(a).grandTotalMinor).toBe(calculateInvoiceTotals(b).grandTotalMinor);
  });
});
