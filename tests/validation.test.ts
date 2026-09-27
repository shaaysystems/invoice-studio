import { describe, expect, it } from "vitest";
import { businessProfileSchema, collectInvoiceIssues, invoiceSchema } from "@/lib/validation/invoice-schema";
import { createDefaultBusinessProfile, createDemoInvoice, createEmptyInvoice } from "@/lib/invoice/defaults";
import type { BusinessProfile } from "@/types/business";
import { scaleQuantity } from "@/lib/money";
import { validateGSTIN } from "@/lib/validation/gstin";

/** A valid invoice to mutate in each negative test. */
function validInvoice() {
  const demo = createDemoInvoice();
  return { ...demo, number: "INV-001" };
}

describe("invoiceSchema", () => {
  it("accepts the demo invoice", () => {
    expect(invoiceSchema.safeParse(validInvoice()).success).toBe(true);
  });

  it("requires an invoice number", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice(), number: "" });
    expect(result.success).toBe(false);
  });

  it("requires at least one line item", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice(), items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a due date before the invoice date", () => {
    const result = invoiceSchema.safeParse({
      ...validInvoice(),
      issueDate: "2026-04-15",
      dueDate: "2026-04-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "dueDate")).toBe(true);
    }
  });

  it("accepts an empty due date", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice(), dueDate: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed date", () => {
    expect(invoiceSchema.safeParse({ ...validInvoice(), issueDate: "15-04-2026" }).success).toBe(false);
  });

  it("requires a place of supply when GST is on", () => {
    const result = invoiceSchema.safeParse({
      ...validInvoice(),
      taxMode: "gst",
      placeOfSupply: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("does not require a place of supply when GST is off", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice(), taxMode: "none", placeOfSupply: "" });
    expect(result.success).toBe(true);
  });

  it("caps a percentage discount at 100", () => {
    const invoice = validInvoice();
    expect(
      invoiceSchema.safeParse({ ...invoice, globalDiscountType: "percent", globalDiscountValue: 150 }).success,
    ).toBe(false);
  });

  it("allows an amount discount above 100", () => {
    const invoice = validInvoice();
    expect(
      invoiceSchema.safeParse({ ...invoice, globalDiscountType: "amount", globalDiscountValue: 5000 }).success,
    ).toBe(true);
  });

  it("rejects a negative rate or quantity", () => {
    const invoice = validInvoice();
    expect(
      invoiceSchema.safeParse({
        ...invoice,
        items: [{ ...invoice.items[0]!, rateMinor: -1 }],
      }).success,
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({
        ...invoice,
        items: [{ ...invoice.items[0]!, quantity: 0 }],
      }).success,
    ).toBe(false);
  });

  it("rejects a fractional stored quantity", () => {
    const invoice = validInvoice();
    // Quantities are milli-scaled, so a stored value must be a whole number.
    expect(
      invoiceSchema.safeParse({ ...invoice, items: [{ ...invoice.items[0]!, quantity: 1.5 }] }).success,
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({ ...invoice, items: [{ ...invoice.items[0]!, quantity: scaleQuantity(1) }] }).success,
    ).toBe(true);
  });

  it("rejects a GST rate above 100", () => {
    const invoice = validInvoice();
    expect(
      invoiceSchema.safeParse({ ...invoice, items: [{ ...invoice.items[0]!, taxRate: 101 }] }).success,
    ).toBe(false);
  });

  it("rejects an invalid brand colour", () => {
    const invoice = validInvoice();
    expect(
      invoiceSchema.safeParse({ ...invoice, brand: { ...invoice.brand, primary: "not-a-colour" } }).success,
    ).toBe(false);
  });

  it("rejects an invalid GSTIN", () => {
    const invoice = validInvoice();
    expect(
      invoiceSchema.safeParse({ ...invoice, business: { ...invoice.business, gstin: "XX" } }).success,
    ).toBe(false);
  });

  it("accepts an empty optional GSTIN", () => {
    const invoice = validInvoice();
    expect(
      invoiceSchema.safeParse({ ...invoice, business: { ...invoice.business, gstin: "" } }).success,
    ).toBe(true);
  });

  it("rejects an image field that is neither a data URL nor http", () => {
    const invoice = validInvoice();
    expect(
      invoiceSchema.safeParse({ ...invoice, business: { ...invoice.business, logoUrl: "javascript:alert(1)" } })
        .success,
    ).toBe(false);
  });

  it("accepts a data URL or https image", () => {
    const invoice = validInvoice();
    expect(
      invoiceSchema.safeParse({
        ...invoice,
        business: { ...invoice.business, logoUrl: "https://cdn.example.com/logo.png" },
      }).success,
    ).toBe(true);
    expect(
      invoiceSchema.safeParse({
        ...invoice,
        business: { ...invoice.business, logoUrl: "data:image/png;base64,iVBORw0KGgo=" },
      }).success,
    ).toBe(true);
  });

  it("requires the business and client names", () => {
    const invoice = validInvoice();
    expect(
      invoiceSchema.safeParse({ ...invoice, business: { ...invoice.business, name: "  " } }).success,
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({ ...invoice, client: { ...invoice.client, name: "" } }).success,
    ).toBe(false);
  });
});

describe("collectInvoiceIssues", () => {
  it("returns nothing for a valid invoice", () => {
    expect(collectInvoiceIssues(validInvoice())).toEqual([]);
  });

  it("returns a human label rather than a raw path where one is mapped", () => {
    const issues = collectInvoiceIssues({ ...validInvoice(), client: { ...validInvoice().client, name: "" } });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.label).toBe("Client name");
    expect(issues[0]?.message).toBe("Client name is required.");
  });

  it("falls back to the path when no label is mapped", () => {
    const issues = collectInvoiceIssues({ ...validInvoice(), globalDiscountValue: -5 });
    expect(issues[0]?.path).toBe("globalDiscountValue");
  });
});

/** A profile that is complete enough to validate; the name is the one required field. */
function namedProfile(overrides: Partial<BusinessProfile> = {}) {
  const profile = createDefaultBusinessProfile();
  return { ...profile, ...overrides, party: { ...profile.party, name: "Northstar Studio", ...overrides.party } };
}

describe("businessProfileSchema", () => {
  it("rejects the blank default until the business name is filled in", () => {
    // Mirrors `createEmptyInvoice`: the shape is right, the required field is
    // deliberately left for the user.
    expect(businessProfileSchema.safeParse(createDefaultBusinessProfile()).success).toBe(false);
    expect(businessProfileSchema.safeParse(namedProfile()).success).toBe(true);
  });

  it("requires a non-empty business name", () => {
    const profile = createDefaultBusinessProfile();
    expect(
      businessProfileSchema.safeParse({ ...profile, party: { ...profile.party, name: "" } }).success,
    ).toBe(false);
  });

  it("requires a numbering prefix made of safe characters", () => {
    const profile = namedProfile();
    const withPrefix = (prefix: string) =>
      businessProfileSchema.safeParse({ ...profile, numbering: { ...profile.numbering, prefix } });

    expect(withPrefix("INV-2026/AB").success).toBe(true);
    expect(withPrefix("").success).toBe(false);
    expect(withPrefix("INV * 2026").success).toBe(false);
  });

  it("keeps the sequence at one or more and the padding in range", () => {
    const profile = namedProfile();
    const withNumbering = (fields: Record<string, number>) =>
      businessProfileSchema.safeParse({ ...profile, numbering: { ...profile.numbering, ...fields } });

    expect(withNumbering({ nextSequence: 0 }).success).toBe(false);
    expect(withNumbering({ nextSequence: 1 }).success).toBe(true);
    expect(withNumbering({ padding: 0 }).success).toBe(false);
    expect(withNumbering({ padding: 9 }).success).toBe(false);
    expect(withNumbering({ padding: 3 }).success).toBe(true);
  });

  it("caps the default tax rate at 100", () => {
    const profile = namedProfile();
    expect(businessProfileSchema.safeParse({ ...profile, defaultTaxRate: 101 }).success).toBe(false);
    expect(businessProfileSchema.safeParse({ ...profile, defaultTaxRate: 28 }).success).toBe(true);
  });

  it("reuses the invoice party rules, so a profile GSTIN is validated too", () => {
    const profile = namedProfile();
    expect(
      businessProfileSchema.safeParse({ ...profile, party: { ...profile.party, gstin: "not-a-gstin" } }).success,
    ).toBe(false);
    expect(
      businessProfileSchema.safeParse({ ...profile, party: { ...profile.party, gstin: "32AAAAA0000A1ZB" } })
        .success,
    ).toBe(true);
  });

  it("rejects an invalid bank IFSC or UPI ID", () => {
    const profile = namedProfile();
    const bad = (payment: Record<string, unknown>) =>
      businessProfileSchema.safeParse({ ...profile, payment: { ...profile.payment, ...payment } });

    expect(bad({ upiId: "not-a-upi" }).success).toBe(false);
    expect(bad({ upiId: "studio@okhdfcbank" }).success).toBe(true);
    expect(
      businessProfileSchema.safeParse({
        ...profile,
        payment: { ...profile.payment, bank: { ...profile.payment.bank, ifsc: "BAD" } },
      }).success,
    ).toBe(false);
  });
});

describe("schema agreement with the demo data", () => {
  it("keeps the demo GSTINs self-consistent", () => {
    const demo = createDemoInvoice();
    if (demo.business.gstin) expect(validateGSTIN(demo.business.gstin)).toBe(true);
    if (demo.client.gstin) expect(validateGSTIN(demo.client.gstin)).toBe(true);
  });

  it("rejects the empty factory, as expected before a number is assigned", () => {
    // Documents the intent: an empty draft is not saveable yet.
    expect(invoiceSchema.safeParse(createEmptyInvoice()).success).toBe(false);
  });
});
