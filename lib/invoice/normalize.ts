import type { BusinessProfile } from "@/types/business";
import type {
  Address,
  BankDetails,
  BusinessParty,
  ClientParty,
  DiscountType,
  GstScope,
  Invoice,
  InvoiceBrand,
  InvoiceItem,
  PaymentDetails,
  PaymentQr,
  PaymentQrMode,
  SignatureBlock,
  SocialLinks,
  TaxMode,
} from "@/types/invoice";
import { createEmptyInvoice, DEFAULT_QR_LABEL, emptyAddress, newId } from "./defaults";

type Dict = Record<string, unknown>;

const isDict = (value: unknown): value is Dict => typeof value === "object" && value !== null && !Array.isArray(value);
const asString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);
const asBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);
const asNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Invoices and profiles are persisted as whole JSON documents, so a payload
 * written before a field existed is a valid record that is simply missing it.
 * Everything read back from storage or the database passes through here, which
 * keeps the rest of the app free of `?? {}` guards and guarantees the runtime
 * shape matches the TypeScript types.
 */

export function defaultPaymentQr(): PaymentQr {
  return { mode: "none", imageUrl: "", label: DEFAULT_QR_LABEL, includeAmount: true };
}

const QR_MODES: PaymentQrMode[] = ["none", "upload", "upi"];

export function normalizePaymentQr(value: unknown): PaymentQr {
  const base = defaultPaymentQr();
  if (!isDict(value)) return base;
  const mode = value.mode;
  return {
    mode: QR_MODES.includes(mode as PaymentQrMode) ? (mode as PaymentQrMode) : base.mode,
    imageUrl: asString(value.imageUrl),
    label: asString(value.label, base.label),
    includeAmount: asBoolean(value.includeAmount, base.includeAmount),
  };
}

function normalizeAddress(value: unknown): Address {
  const base = emptyAddress();
  if (!isDict(value)) return base;
  return {
    line1: asString(value.line1),
    line2: asString(value.line2),
    city: asString(value.city),
    state: asString(value.state),
    stateCode: asString(value.stateCode),
    pincode: asString(value.pincode),
    country: asString(value.country, base.country),
  };
}

function normalizeSocials(value: unknown): SocialLinks {
  const base: SocialLinks = { website: "", instagram: "", linkedin: "", twitter: "" };
  if (!isDict(value)) return base;
  return {
    website: asString(value.website),
    instagram: asString(value.instagram),
    linkedin: asString(value.linkedin),
    twitter: asString(value.twitter),
  };
}

function normalizeBusiness(value: unknown): BusinessParty {
  const base = isDict(value) ? value : {};
  return {
    name: asString(base.name),
    legalName: asString(base.legalName),
    gstin: asString(base.gstin),
    pan: asString(base.pan),
    email: asString(base.email),
    phone: asString(base.phone),
    address: normalizeAddress(base.address),
    logoUrl: asString(base.logoUrl),
    socials: normalizeSocials(base.socials),
  };
}

function normalizeClient(value: unknown): ClientParty {
  const base = isDict(value) ? value : {};
  return {
    name: asString(base.name),
    gstin: asString(base.gstin),
    pan: asString(base.pan),
    email: asString(base.email),
    phone: asString(base.phone),
    billingAddress: normalizeAddress(base.billingAddress),
    shippingAddress: normalizeAddress(base.shippingAddress),
    shipToSameAsBillTo: asBoolean(base.shipToSameAsBillTo, true),
    logoUrl: asString(base.logoUrl),
  };
}

function normalizeBank(value: unknown): BankDetails {
  const base = isDict(value) ? value : {};
  return {
    accountName: asString(base.accountName),
    accountNumber: asString(base.accountNumber),
    ifsc: asString(base.ifsc),
    bankName: asString(base.bankName),
    branch: asString(base.branch),
  };
}

function normalizePayment(value: unknown): PaymentDetails {
  const base = isDict(value) ? value : {};
  return {
    bank: normalizeBank(base.bank),
    upiId: asString(base.upiId),
    paymentLink: asString(base.paymentLink),
    paymentNote: asString(base.paymentNote),
    qr: normalizePaymentQr(base.qr),
  };
}

function normalizeSignature(value: unknown): SignatureBlock {
  const base = isDict(value) ? value : {};
  return {
    imageUrl: asString(base.imageUrl),
    name: asString(base.name),
    designation: asString(base.designation),
  };
}

function normalizeBrand(value: unknown): InvoiceBrand {
  const base = isDict(value) ? value : {};
  return {
    primary: asString(base.primary),
    accent: asString(base.accent),
    surface: asString(base.surface),
    text: asString(base.text),
    paletteId: asString(base.paletteId),
    accentBarEnabled: asBoolean(base.accentBarEnabled, true),
    showLogo: asBoolean(base.showLogo, true),
  };
}

const DISCOUNT_TYPES: DiscountType[] = ["none", "percent", "amount"];

function normalizeItem(value: unknown): InvoiceItem {
  const base = isDict(value) ? value : {};
  const discountType = base.discountType as DiscountType;
  return {
    id: asString(base.id, newId()),
    description: asString(base.description),
    hsn: asString(base.hsn),
    quantity: asNumber(base.quantity, 1000),
    unit: asString(base.unit, "pcs"),
    rateMinor: asNumber(base.rateMinor, 0),
    taxRate: asNumber(base.taxRate, 0),
    discountType: DISCOUNT_TYPES.includes(discountType) ? discountType : "none",
    discountValue: asNumber(base.discountValue, 0),
  };
}

const TAX_MODES: TaxMode[] = ["none", "gst"];
const GST_SCOPES: GstScope[] = ["intra", "inter"];

/** Returns null for anything that is not an object, so callers can skip it. */
export function normalizeInvoice(value: unknown): Invoice | null {
  if (!isDict(value)) return null;
  const base = createEmptyInvoice();
  const items = Array.isArray(value.items) ? value.items.map(normalizeItem) : base.items;
  const taxMode = value.taxMode as TaxMode;
  const gstScope = value.gstScope as GstScope;
  const globalDiscountType = value.globalDiscountType as DiscountType;

  return {
    id: asString(value.id, base.id),
    number: asString(value.number),
    issueDate: asString(value.issueDate, base.issueDate),
    dueDate: asString(value.dueDate),
    poNumber: asString(value.poNumber),
    placeOfSupply: asString(value.placeOfSupply),
    currency: "INR",
    taxMode: TAX_MODES.includes(taxMode) ? taxMode : "none",
    gstScope: GST_SCOPES.includes(gstScope) ? gstScope : "intra",
    pricesIncludeTax: asBoolean(value.pricesIncludeTax, false),
    business: normalizeBusiness(value.business),
    client: normalizeClient(value.client),
    // The editor always shows at least one row, so an empty table stays usable.
    items: items.length > 0 ? items : base.items,
    globalDiscountType: DISCOUNT_TYPES.includes(globalDiscountType) ? globalDiscountType : "none",
    globalDiscountValue: asNumber(value.globalDiscountValue, 0),
    shippingMinor: asNumber(value.shippingMinor, 0),
    advanceMinor: asNumber(value.advanceMinor, 0),
    roundOffEnabled: asBoolean(value.roundOffEnabled, true),
    amountInWordsEnabled: asBoolean(value.amountInWordsEnabled, true),
    notes: asString(value.notes),
    terms: asString(value.terms),
    payment: normalizePayment(value.payment),
    signature: normalizeSignature(value.signature),
    brand: normalizeBrand(value.brand),
    logoOverrideUrl: asString(value.logoOverrideUrl),
    businessProfileId: asString(value.businessProfileId),
    createdAt: asString(value.createdAt, base.createdAt),
    updatedAt: asString(value.updatedAt, base.updatedAt),
  };
}

/** Same forward-compatibility guarantee for the saved business profile. */
export function normalizeBusinessProfile(value: unknown): BusinessProfile | null {
  if (!isDict(value)) return null;
  const numbering = isDict(value.numbering) ? value.numbering : {};
  return {
    id: asString(value.id, newId()),
    userId: asString(value.userId, "local"),
    party: normalizeBusiness(value.party),
    payment: normalizePayment(value.payment),
    signature: normalizeSignature(value.signature),
    defaultTerms: asString(value.defaultTerms),
    defaultNotes: asString(value.defaultNotes),
    defaultTaxRate: asNumber(value.defaultTaxRate, 18),
    numbering: {
      prefix: asString(numbering.prefix, "INV"),
      nextSequence: Math.max(1, Math.trunc(asNumber(numbering.nextSequence, 1))),
      padding: Math.min(8, Math.max(1, Math.trunc(asNumber(numbering.padding, 3)))),
      resetYearly: asBoolean(numbering.resetYearly, true),
      financialYear: asString(numbering.financialYear),
    },
    updatedAt: asString(value.updatedAt),
  };
}
