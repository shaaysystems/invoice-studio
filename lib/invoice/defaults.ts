import { addDaysISO, todayISO } from "@/lib/formatting/inr";
import { defaultBrand } from "@/lib/brand/presets";
import {
  defaultNumberingProfile,
  generateInvoiceNumber,
  numberingConfigFromProfile,
  rollNumberingIfYearChanged,
} from "@/lib/invoice/numbering";
import { QTY_SCALE, rupeesToMinor, scaleQuantity } from "@/lib/money";
import type { BusinessProfile } from "@/types/business";
import type { Address, Invoice, InvoiceItem, PaymentQr, SocialLinks } from "@/types/invoice";

export const UNIT_OPTIONS = ["pcs", "hours", "days", "projects", "months", "units", "service"] as const;

export const DEFAULT_TERMS = [
  "Payment is due within 7 days of the invoice date.",
  "Please include the invoice number with the payment reference.",
  "Any applicable taxes are included as shown above.",
].join("\n");

export const DEFAULT_NOTES = "Thank you for your business.";

export const TAX_DISCLAIMER =
  "Tax fields are provided for invoicing purposes. Verify tax treatment for your specific business with a qualified professional.";

export const DEMO_NOTICE = "Demo content — replace with your own details.";

export const DEFAULT_QR_LABEL = "Scan to pay";

const emptyQr = (): PaymentQr => ({
  mode: "none",
  imageUrl: "",
  label: DEFAULT_QR_LABEL,
  includeAmount: true,
});

export const newId = (): string => globalThis.crypto.randomUUID();

export function createEmptyItem(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    id: newId(),
    description: "",
    hsn: "",
    quantity: QTY_SCALE,
    unit: "pcs",
    rateMinor: 0,
    taxRate: 18,
    discountType: "none",
    discountValue: 0,
    ...overrides,
  };
}

export const emptyAddress = (): Address => ({
  line1: "",
  line2: "",
  city: "",
  state: "",
  stateCode: "",
  pincode: "",
  country: "India",
});

const emptySocials = (): SocialLinks => ({ website: "", instagram: "", linkedin: "", twitter: "" });

export function createEmptyInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const now = new Date().toISOString();
  const issueDate = todayISO();

  return {
    id: newId(),
    number: "",
    issueDate,
    dueDate: addDaysISO(issueDate, 7),
    poNumber: "",
    placeOfSupply: "",
    currency: "INR",
    taxMode: "none",
    gstScope: "intra",
    pricesIncludeTax: false,
    business: {
      name: "",
      legalName: "",
      gstin: "",
      pan: "",
      email: "",
      phone: "",
      address: emptyAddress(),
      logoUrl: "",
      socials: emptySocials(),
    },
    client: {
      name: "",
      gstin: "",
      pan: "",
      email: "",
      phone: "",
      billingAddress: emptyAddress(),
      shippingAddress: emptyAddress(),
      shipToSameAsBillTo: true,
      logoUrl: "",
    },
    items: [createEmptyItem()],
    globalDiscountType: "none",
    globalDiscountValue: 0,
    shippingMinor: 0,
    advanceMinor: 0,
    roundOffEnabled: true,
    amountInWordsEnabled: true,
    notes: DEFAULT_NOTES,
    terms: DEFAULT_TERMS,
    payment: {
      bank: { accountName: "", accountNumber: "", ifsc: "", bankName: "", branch: "" },
      upiId: "",
      paymentLink: "",
      paymentNote: "",
      qr: emptyQr(),
    },
    signature: { imageUrl: "", name: "", designation: "" },
    brand: defaultBrand(),
    logoOverrideUrl: "",
    businessProfileId: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Prefills a new invoice from a saved business profile. The party is copied by
 * value, so later profile edits never rewrite invoices already issued.
 */
export function invoiceFromProfile(profile: BusinessProfile, number: string): Invoice {
  const base = createEmptyInvoice();
  return {
    ...base,
    number,
    businessProfileId: profile.id,
    business: { ...profile.party, address: { ...profile.party.address }, socials: { ...profile.party.socials } },
    payment: { ...profile.payment, bank: { ...profile.payment.bank }, qr: { ...emptyQr(), ...profile.payment.qr } },
    signature: { ...profile.signature },
    terms: profile.defaultTerms,
    notes: profile.defaultNotes,
    items: [createEmptyItem({ taxRate: profile.defaultTaxRate })],
  };
}

/**
 * Builds a fresh invoice from a saved profile, including the next invoice
 * number. The financial year is rolled here (not only on save) so a profile
 * written last year cannot hand out a stale sequence.
 */
export function invoiceFromSavedProfile(profile: BusinessProfile): Invoice {
  const { numbering } = rollNumberingIfYearChanged(profile.numbering);
  return invoiceFromProfile(profile, generateInvoiceNumber(numberingConfigFromProfile(numbering)));
}

/**
 * Re-applies a saved profile onto an invoice that is already being edited.
 * Only the sender-owned fields are touched — the client, the line items and
 * the invoice number belong to this document and are left untouched.
 */
export function applyProfileToInvoice(invoice: Invoice, profile: BusinessProfile): Invoice {
  return {
    ...invoice,
    businessProfileId: profile.id,
    business: {
      ...profile.party,
      address: { ...profile.party.address },
      socials: { ...profile.party.socials },
    },
    payment: {
      ...profile.payment,
      bank: { ...profile.payment.bank },
      qr: { ...invoice.payment.qr, ...profile.payment.qr },
    },
    signature: { ...profile.signature },
    terms: profile.defaultTerms,
    notes: profile.defaultNotes,
  };
}

/**
 * True when the invoice already carries sender details of its own, so applying
 * a saved profile would overwrite real work instead of filling an empty form.
 */
export function invoiceHasOwnBusinessDetails(invoice: Invoice): boolean {
  return Boolean(
    invoice.business.name.trim() ||
      invoice.business.gstin.trim() ||
      invoice.business.pan.trim() ||
      invoice.business.email.trim() ||
      invoice.business.phone.trim() ||
      invoice.business.address.line1.trim() ||
      invoice.payment.upiId.trim() ||
      invoice.payment.bank.accountNumber.trim(),
  );
}

/** Starting point for the business-profile editor — valid against the Zod schema. */
export function createDefaultBusinessProfile(userId = "local"): BusinessProfile {
  const now = new Date().toISOString();
  return {
    id: newId(),
    userId,
    party: {
      name: "",
      legalName: "",
      gstin: "",
      pan: "",
      email: "",
      phone: "",
      address: emptyAddress(),
      logoUrl: "",
      socials: emptySocials(),
    },
    payment: {
      bank: { accountName: "", accountNumber: "", ifsc: "", bankName: "", branch: "" },
      upiId: "",
      paymentLink: "",
      paymentNote: "",
      qr: emptyQr(),
    },
    signature: { imageUrl: "", name: "", designation: "" },
    defaultTerms: DEFAULT_TERMS,
    defaultNotes: DEFAULT_NOTES,
    defaultTaxRate: 18,
    numbering: defaultNumberingProfile(),
    updatedAt: now,
  };
}

/* ---------------- Demo data (clearly marked, never real) ---------------- */

export function createDemoInvoice(): Invoice {
  const base = createEmptyInvoice();
  const issueDate = todayISO();

  return {
    ...base,
    number: "INV-2026-001",
    issueDate,
    dueDate: addDaysISO(issueDate, 7),
    placeOfSupply: "Karnataka (29)",
    taxMode: "gst",
    gstScope: "inter",
    business: {
      name: "Northstar Creative Studio",
      legalName: "Northstar Creative Studio LLP",
      gstin: "32AAAAA0000A1ZB",
      pan: "AAAAA0000A",
      email: "studio@example.com",
      phone: "+91 90000 00000",
      address: {
        line1: "Demo Address, 2nd Floor",
        line2: "Sample Business Park",
        city: "Kochi",
        state: "Kerala",
        stateCode: "32",
        pincode: "682001",
        country: "India",
      },
      logoUrl: "",
      socials: { website: "example.com", instagram: "@example.studio", linkedin: "example-studio", twitter: "" },
    },
    client: {
      name: "Acme Technologies Pvt. Ltd.",
      gstin: "29AABCK9602R1ZU",
      pan: "AAAAA0000A",
      email: "accounts@example.com",
      phone: "+91 80000 00000",
      billingAddress: {
        line1: "Demo Tower, Block C",
        line2: "",
        city: "Bengaluru",
        state: "Karnataka",
        stateCode: "29",
        pincode: "560001",
        country: "India",
      },
      shippingAddress: emptyAddress(),
      shipToSameAsBillTo: true,
      logoUrl: "",
    },
    items: [
      createEmptyItem({
        description: "Brand Strategy",
        hsn: "998311",
        unit: "projects",
        quantity: QTY_SCALE,
        rateMinor: rupeesToMinor(25000),
        taxRate: 18,
      }),
      createEmptyItem({
        description: "Visual Identity",
        hsn: "998311",
        unit: "projects",
        quantity: QTY_SCALE,
        rateMinor: rupeesToMinor(40000),
        taxRate: 18,
      }),
      createEmptyItem({
        description: "Social Media Design",
        hsn: "998391",
        unit: "pcs",
        quantity: 10 * QTY_SCALE,
        rateMinor: rupeesToMinor(1500),
        taxRate: 18,
      }),
    ],
    globalDiscountType: "none",
    globalDiscountValue: 0,
    roundOffEnabled: true,
    payment: {
      bank: {
        accountName: "Northstar Creative Studio",
        accountNumber: "XXXX XXXX XXXX",
        ifsc: "DEMO0000001",
        bankName: "Demo Bank",
        branch: "Demo Branch",
      },
      upiId: "demo@upi",
      paymentLink: "",
      paymentNote: "",
      qr: { ...emptyQr(), mode: "upi", label: "Scan to pay" },
    },
    signature: { imageUrl: "", name: "Demo Signatory", designation: "Creative Director" },
    brand: defaultBrand(),
  };
}

/** Long-invoice fixture used by pagination tests and the /dev preview route. */
export function createLongDemoInvoice(itemCount = 42): Invoice {
  const demo = createDemoInvoice();
  const items = Array.from({ length: itemCount }, (_, index) =>
    createEmptyItem({
      description: `Deliverable ${index + 1} — Extended campaign production workstream`,
      hsn: "998391",
      unit: index % 2 === 0 ? "hours" : "pcs",
      quantity: index % 2 === 0 ? scaleQuantity(7.5) : 3 * QTY_SCALE,
      rateMinor: rupeesToMinor(1500 + index * 125),
      taxRate: 18,
    }),
  );
  return { ...demo, number: "INV-2026-0042", items };
}
