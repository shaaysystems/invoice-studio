import { describe, expect, it } from "vitest";
import { buildUpiPaymentUri, formatUpiAmount, isValidUpiHandle } from "@/lib/payment/upi";
import { paymentQrPayload, resolvePaymentQr } from "@/lib/payment/qr";
import { createEmptyInvoice } from "@/lib/invoice/defaults";
import type { Invoice } from "@/types/invoice";

function invoiceWith(patch: Partial<Invoice["payment"]> & { upiId?: string }): Invoice {
  const invoice = createEmptyInvoice();
  invoice.business.name = "Northstar Studio";
  invoice.number = "INV-001";
  invoice.payment = { ...invoice.payment, ...patch };
  return invoice;
}

describe("formatUpiAmount", () => {
  it("converts paise to a two-decimal string", () => {
    expect(formatUpiAmount(123456)).toBe("1234.56");
    expect(formatUpiAmount(1)).toBe("0.01");
    expect(formatUpiAmount(100000)).toBe("1000.00");
  });

  it("returns an empty string for amounts a payer cannot act on", () => {
    expect(formatUpiAmount(0)).toBe("");
    expect(formatUpiAmount(-500)).toBe("");
    expect(formatUpiAmount(Number.NaN)).toBe("");
  });

  it("avoids exponent notation on very large amounts", () => {
    expect(formatUpiAmount(1e21)).toBe("10000000000000000000.00");
  });
});

describe("isValidUpiHandle", () => {
  it("accepts real VPAs", () => {
    expect(isValidUpiHandle("northstar@okhdfcbank")).toBe(true);
    expect(isValidUpiHandle("  northstar@ybl  ")).toBe(true);
    expect(isValidUpiHandle("a.b-c@upi")).toBe(true);
  });

  it("rejects anything that would produce an unscannable code", () => {
    expect(isValidUpiHandle("")).toBe(false);
    expect(isValidUpiHandle("northstar")).toBe(false);
    expect(isValidUpiHandle("@okhdfcbank")).toBe(false);
    expect(isValidUpiHandle("northstar@")).toBe(false);
    expect(isValidUpiHandle("north star@okhdfcbank")).toBe(false);
    expect(isValidUpiHandle("northstar@bank name")).toBe(false);
  });
});

describe("buildUpiPaymentUri", () => {
  it("builds a link that carries the amount and reference", () => {
    const uri = buildUpiPaymentUri({
      upiId: "northstar@okhdfcbank",
      payeeName: "Northstar Studio",
      amountMinor: 123456,
      note: "INV-001",
    });

    expect(uri).toBe(
      "upi://pay?pa=northstar%40okhdfcbank&pn=Northstar%20Studio&am=1234.56&cu=INR&tn=INV-001",
    );
  });

  it("returns null without a usable VPA, so no broken code is generated", () => {
    expect(buildUpiPaymentUri({ upiId: "" })).toBeNull();
    expect(buildUpiPaymentUri({ upiId: "not-a-vpa" })).toBeNull();
  });

  it("always states the currency", () => {
    expect(buildUpiPaymentUri({ upiId: "northstar@okhdfcbank" })).toBe(
      "upi://pay?pa=northstar%40okhdfcbank&cu=INR",
    );
  });

  it("omits the amount when it is unknown or zero", () => {
    const uri = buildUpiPaymentUri({
      upiId: "northstar@okhdfcbank",
      amountMinor: 0,
      note: "INV-001",
    });
    expect(uri).not.toContain("am=");
    expect(uri).toContain("cu=INR");
  });

  it("encodes spaces as %20, never as +", () => {
    // Some UPI apps display a literal "+" instead of decoding it.
    const uri = buildUpiPaymentUri({
      upiId: "northstar@okhdfcbank",
      payeeName: "Northstar Studio LLP",
    });
    expect(uri).toContain("pn=Northstar%20Studio%20LLP");
    expect(uri).not.toContain("+");
  });

  it("replaces control characters with a space and collapses whitespace runs", () => {
    const uri = buildUpiPaymentUri({
      upiId: "northstar@okhdfcbank",
      note: "INV-001\u0007   due",
    });
    expect(uri).toContain("tn=INV-001%20due");
  });

  it("truncates an overlong note rather than emitting a huge QR", () => {
    const uri = buildUpiPaymentUri({ upiId: "northstar@okhdfcbank", note: "x".repeat(200) });
    expect(uri?.split("tn=")[1]).toHaveLength(50);
  });
});

describe("paymentQrPayload", () => {
  it("follows the invoice total when the amount is locked", () => {
    const invoice = invoiceWith({ upiId: "northstar@okhdfcbank" });
    invoice.payment.qr = { mode: "upi", imageUrl: "", label: "Scan to pay", includeAmount: true };

    const payload = paymentQrPayload(invoice, { grandTotalMinor: 500000 });
    expect(payload).toContain("am=5000.00");
  });

  it("leaves the amount out when the lock is off", () => {
    const invoice = invoiceWith({ upiId: "northstar@okhdfcbank" });
    invoice.payment.qr = { mode: "upi", imageUrl: "", label: "Scan to pay", includeAmount: false };

    const payload = paymentQrPayload(invoice, { grandTotalMinor: 500000 });
    expect(payload).not.toContain("am=");
  });
});

describe("resolvePaymentQr", () => {
  it("returns null when the mode is none", () => {
    const invoice = invoiceWith({ upiId: "northstar@okhdfcbank" });
    expect(resolvePaymentQr(invoice, { grandTotalMinor: 500000 })).toBeNull();
  });

  it("returns null for a generated code with no valid UPI ID", () => {
    const invoice = invoiceWith({ upiId: "nonsense" });
    invoice.payment.qr = { mode: "upi", imageUrl: "", label: "Scan to pay", includeAmount: true };
    expect(resolvePaymentQr(invoice, { grandTotalMinor: 500000 })).toBeNull();
  });

  it("returns null for an upload with no image", () => {
    const invoice = invoiceWith({});
    invoice.payment.qr = { mode: "upload", imageUrl: "", label: "", includeAmount: true };
    expect(resolvePaymentQr(invoice, { grandTotalMinor: 500000 })).toBeNull();
  });
});
