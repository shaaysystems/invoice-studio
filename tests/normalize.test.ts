import { describe, expect, it } from "vitest";
import {
  defaultPaymentQr,
  normalizeBusinessProfile,
  normalizeInvoice,
  normalizePaymentQr,
} from "@/lib/invoice/normalize";
import { createEmptyInvoice, DEFAULT_QR_LABEL } from "@/lib/invoice/defaults";

/**
 * Invoices are stored as whole JSON documents, so a payload written before the
 * QR feature existed is a perfectly valid record that is simply missing the
 * field. These tests pin that upgrade path.
 */
describe("normalizePaymentQr", () => {
  it("falls back to defaults when the field is absent", () => {
    expect(normalizePaymentQr(undefined)).toEqual(defaultPaymentQr());
  });

  it("fills in defaults for a partial object", () => {
    expect(normalizePaymentQr({ mode: "upi" })).toEqual({
      mode: "upi",
      imageUrl: "",
      label: DEFAULT_QR_LABEL,
      includeAmount: true,
    });
  });

  it("keeps a stored upload intact", () => {
    const stored = { mode: "upload", imageUrl: "https://x.co/qr.png", label: "Scan", includeAmount: false };
    expect(normalizePaymentQr(stored)).toEqual(stored);
  });

  it("rejects an unknown mode rather than rendering a broken code", () => {
    expect(normalizePaymentQr({ mode: "bitcoin" }).mode).toBe("none");
  });

  it("ignores a non-object", () => {
    expect(normalizePaymentQr("nope")).toEqual(defaultPaymentQr());
    expect(normalizePaymentQr(null)).toEqual(defaultPaymentQr());
    expect(normalizePaymentQr([1, 2])).toEqual(defaultPaymentQr());
  });
});

describe("normalizeInvoice", () => {
  it("returns null for a non-object", () => {
    expect(normalizeInvoice(null)).toBeNull();
    expect(normalizeInvoice("invoice")).toBeNull();
    expect(normalizeInvoice([1])).toBeNull();
  });

  it("gives a pre-QR invoice a valid payment block", () => {
    const legacy = createEmptyInvoice() as unknown as Record<string, unknown>;
    delete legacy.payment;

    const invoice = normalizeInvoice(legacy);
    expect(invoice).not.toBeNull();
    expect(invoice!.payment.qr).toEqual(defaultPaymentQr());
  });

  it("keeps a pre-logo-override invoice working", () => {
    const legacy = createEmptyInvoice() as unknown as Record<string, unknown>;
    delete legacy.logoOverrideUrl;

    expect(normalizeInvoice(legacy)!.logoOverrideUrl).toBe("");
  });

  it("preserves a stored QR and logo override", () => {
    const invoice = normalizeInvoice({
      ...createEmptyInvoice(),
      logoOverrideUrl: "https://x.co/alt.png",
      payment: {
        ...createEmptyInvoice().payment,
        qr: { mode: "upload", imageUrl: "https://x.co/qr.png", label: "Pay", includeAmount: false },
      },
    });

    expect(invoice!.logoOverrideUrl).toBe("https://x.co/alt.png");
    expect(invoice!.payment.qr.mode).toBe("upload");
    expect(invoice!.payment.qr.includeAmount).toBe(false);
  });

  it("repairs a malformed QR mode without discarding the image", () => {
    const invoice = normalizeInvoice({
      ...createEmptyInvoice(),
      payment: {
        ...createEmptyInvoice().payment,
        qr: { mode: "wat", imageUrl: "https://x.co/qr.png" },
      },
    });

    expect(invoice!.payment.qr.mode).toBe("none");
    expect(invoice!.payment.qr.imageUrl).toBe("https://x.co/qr.png");
  });
});

describe("normalizeBusinessProfile", () => {
  it("returns null for a non-object", () => {
    expect(normalizeBusinessProfile(undefined)).toBeNull();
  });

  it("gives a pre-QR profile a valid payment QR", () => {
    const profile = normalizeBusinessProfile({ party: { name: "Northstar" }, payment: { upiId: "a@b" } });

    expect(profile!.party.name).toBe("Northstar");
    expect(profile!.payment.upiId).toBe("a@b");
    expect(profile!.payment.qr).toEqual(defaultPaymentQr());
  });

  it("keeps a stored default QR", () => {
    const profile = normalizeBusinessProfile({
      payment: { qr: { mode: "upi", imageUrl: "", label: "Scan", includeAmount: false } },
    });

    expect(profile!.payment.qr.mode).toBe("upi");
    expect(profile!.payment.qr.includeAmount).toBe(false);
  });
});
