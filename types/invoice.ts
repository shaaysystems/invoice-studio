export type TaxMode = "none" | "gst";
export type GstScope = "intra" | "inter";
export type DiscountType = "none" | "percent" | "amount";

export interface Address {
  line1: string;
  line2: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  country: string;
}

export interface SocialLinks {
  website: string;
  instagram: string;
  linkedin: string;
  twitter: string;
}

export interface BusinessParty {
  name: string;
  legalName: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  address: Address;
  logoUrl: string;
  socials: SocialLinks;
}

export interface ClientParty {
  name: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  billingAddress: Address;
  shippingAddress: Address;
  shipToSameAsBillTo: boolean;
  /**
   * Optional logo of the party being invoiced, printed in the "Bill to" block.
   * Per-invoice only — there is no client profile to carry a default from.
   */
  logoUrl: string;
}

/** quantity is stored scaled by QTY_SCALE (1000). rateMinor is paise. */
export interface InvoiceItem {
  id: string;
  description: string;
  hsn: string;
  quantity: number;
  unit: string;
  rateMinor: number;
  taxRate: number;
  discountType: DiscountType;
  discountValue: number;
}

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  branch: string;
}

/**
 * How the pay-by-QR code is produced.
 * - `none`   no code on the invoice
 * - `upload` an image the sender uploaded (their bank's or a UPI app's code)
 * - `upi`    generated here from `payment.upiId`, optionally locking the amount
 */
export type PaymentQrMode = "none" | "upload" | "upi";

export interface PaymentQr {
  mode: PaymentQrMode;
  /** Only read when mode is "upload" — a data URL in guest mode, else a storage URL. */
  imageUrl: string;
  /** Caption printed above the code. */
  label: string;
  /** Embeds the invoice grand total in a generated code so the payer types nothing. */
  includeAmount: boolean;
}

export interface PaymentDetails {
  bank: BankDetails;
  upiId: string;
  paymentLink: string;
  paymentNote: string;
  qr: PaymentQr;
}

export interface SignatureBlock {
  imageUrl: string;
  name: string;
  designation: string;
}

export interface InvoiceBrand {
  primary: string;
  accent: string;
  surface: string;
  text: string;
  paletteId: string;
  accentBarEnabled: boolean;
  showLogo: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  poNumber: string;
  placeOfSupply: string;
  currency: "INR";
  taxMode: TaxMode;
  gstScope: GstScope;
  pricesIncludeTax: boolean;
  business: BusinessParty;
  client: ClientParty;
  items: InvoiceItem[];
  globalDiscountType: DiscountType;
  globalDiscountValue: number;
  shippingMinor: number;
  /**
   * Advance already received from the client, in paise. Zero means "no advance
   * recorded" and is what every invoice that predates this field normalises to.
   * It is capped at the grand total when totals are calculated, so a balance
   * can never go negative.
   */
  advanceMinor: number;
  roundOffEnabled: boolean;
  amountInWordsEnabled: boolean;
  notes: string;
  terms: string;
  payment: PaymentDetails;
  signature: SignatureBlock;
  brand: InvoiceBrand;
  /**
   * Logo for this invoice only. Empty means "use the saved business logo", so
   * read it through `resolveLogoUrl` rather than directly.
   */
  logoOverrideUrl: string;
  /**
   * The saved business profile this invoice was started from, or "" for a
   * blank one. Recorded on the document so invoice numbers stay unique per
   * business even after the profile is renamed or deleted. Never read it back
   * to prefill fields — the invoice carries its own copy of everything.
   */
  businessProfileId: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineTotals {
  lineId: string;
  grossMinor: number;
  discountMinor: number;
  taxableMinor: number;
  taxMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  totalMinor: number;
}

export interface TaxBucket {
  rate: number;
  taxableMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
}

export interface InvoiceTotals {
  lines: InvoiceLineTotals[];
  subtotalMinor: number;
  lineDiscountMinor: number;
  globalDiscountMinor: number;
  taxableMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  taxMinor: number;
  shippingMinor: number;
  roundOffMinor: number;
  grandTotalMinor: number;
  /** The recorded advance, clamped to `grandTotalMinor`. */
  advanceMinor: number;
  /** What the client still owes: `grandTotalMinor - advanceMinor`. */
  balanceDueMinor: number;
  buckets: TaxBucket[];
}

export interface InvoiceListRow {
  id: string;
  number: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  grandTotalMinor: number;
  status: "draft" | "sent" | "paid";
  updatedAt: string;
}
