import { describe, expect, it } from "vitest";
import {
  applyProfileToInvoice,
  createDefaultBusinessProfile,
  createEmptyInvoice,
  createEmptyItem,
  invoiceFromProfile,
  invoiceFromSavedProfile,
  invoiceHasOwnBusinessDetails,
} from "@/lib/invoice/defaults";
import { defaultNumberingProfile } from "@/lib/invoice/numbering";
import { rupeesToMinor } from "@/lib/money";
import type { BusinessProfile } from "@/types/business";

function savedProfile(): BusinessProfile {
  const profile = createDefaultBusinessProfile("user-1");
  profile.party.name = "Northstar Creative Studio";
  profile.party.gstin = "32AAAAA0000A1Z5";
  profile.party.address.city = "Kochi";
  profile.payment.upiId = "studio@upi";
  profile.payment.bank.accountNumber = "XXXX1234";
  profile.defaultNotes = "Custom note";
  profile.defaultTerms = "Custom term";
  profile.defaultTaxRate = 12;
  return profile;
}

describe("invoiceFromProfile", () => {
  it("copies sender, payment and signature by value", () => {
    const profile = savedProfile();
    const invoice = invoiceFromProfile(profile, "INV-2026-001");

    expect(invoice.number).toBe("INV-2026-001");
    expect(invoice.business.name).toBe(profile.party.name);
    expect(invoice.business.address).not.toBe(profile.party.address);
    expect(invoice.payment.upiId).toBe(profile.payment.upiId);
    expect(invoice.terms).toBe(profile.defaultTerms);
    expect(invoice.notes).toBe(profile.defaultNotes);
    expect(invoice.items[0]?.taxRate).toBe(12);
  });

  it("records which profile it came from", () => {
    const profile = savedProfile();

    expect(invoiceFromProfile(profile, "INV-2026-001").businessProfileId).toBe(profile.id);
  });

  it("leaves a blank invoice unlinked", () => {
    expect(createEmptyInvoice().businessProfileId).toBe("");
  });
});

describe("invoiceFromSavedProfile", () => {
  it("numbers from the profile's prefix, sequence and padding", () => {
    const profile = savedProfile();
    profile.numbering = { ...defaultNumberingProfile(), prefix: "ACME", nextSequence: 42, padding: 4 };

    expect(invoiceFromSavedProfile(profile).number).toBe("ACME-0042");
  });

  it("restarts the sequence when the financial year has rolled over", () => {
    const profile = savedProfile();
    profile.numbering = {
      prefix: "INV",
      nextSequence: 87,
      padding: 3,
      resetYearly: true,
      financialYear: "2019-20",
    };

    expect(invoiceFromSavedProfile(profile).number).toBe("INV-001");
  });

  it("keeps the stored sequence when yearly reset is off", () => {
    const profile = savedProfile();
    profile.numbering = {
      prefix: "INV",
      nextSequence: 87,
      padding: 3,
      resetYearly: false,
      financialYear: "2019-20",
    };

    expect(invoiceFromSavedProfile(profile).number).toBe("INV-087");
  });
});

describe("applyProfileToInvoice", () => {
  it("overwrites sender-owned fields only", () => {
    const profile = savedProfile();
    const invoice = createEmptyInvoice({ number: "INV-2026-009" });
    invoice.client.name = "Acme Technologies Pvt. Ltd.";
    invoice.items = [createEmptyItem({ description: "Design work", rateMinor: rupeesToMinor(5000) })];

    const applied = applyProfileToInvoice(invoice, profile);

    expect(applied.business.name).toBe(profile.party.name);
    expect(applied.business.gstin).toBe(profile.party.gstin);
    expect(applied.payment.upiId).toBe(profile.payment.upiId);
    expect(applied.terms).toBe(profile.defaultTerms);
    expect(applied.notes).toBe(profile.defaultNotes);
    // Untouched: the document owns these.
    expect(applied.client.name).toBe("Acme Technologies Pvt. Ltd.");
    expect(applied.items).toBe(invoice.items);
    expect(applied.number).toBe("INV-2026-009");
  });

  it("re-points the link at the profile it was applied from", () => {
    const first = savedProfile();
    const second = savedProfile();
    second.id = "id-second";
    second.party.name = "Acme Consulting";

    const applied = applyProfileToInvoice(createEmptyInvoice(), second);

    expect(applied.businessProfileId).toBe("id-second");
    expect(first.id).not.toBe("id-second");
  });

  it("shares no nested object with the profile", () => {
    const profile = savedProfile();
    const applied = applyProfileToInvoice(createEmptyInvoice(), profile);

    expect(applied.business).not.toBe(profile.party);
    expect(applied.business.socials).not.toBe(profile.party.socials);
    expect(applied.payment.bank).not.toBe(profile.payment.bank);
    expect(applied.signature).not.toBe(profile.signature);
  });
});

describe("invoiceHasOwnBusinessDetails", () => {
  it("is false for a fresh invoice", () => {
    expect(invoiceHasOwnBusinessDetails(createEmptyInvoice())).toBe(false);
  });

  it("is true once any sender identifier is filled in", () => {
    const invoice = createEmptyInvoice();
    invoice.business.gstin = "32AAAAA0000A1Z5";

    expect(invoiceHasOwnBusinessDetails(invoice)).toBe(true);
  });

  it("treats whitespace-only entries as blank", () => {
    const invoice = createEmptyInvoice();
    invoice.business.name = "   ";

    expect(invoiceHasOwnBusinessDetails(invoice)).toBe(false);
  });

  it("is true once bank details alone are entered", () => {
    const invoice = createEmptyInvoice();
    invoice.payment.bank.accountNumber = "XXXX1234";

    expect(invoiceHasOwnBusinessDetails(invoice)).toBe(true);
  });
});
