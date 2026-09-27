import { isValidUpiHandle } from "@/lib/payment/upi";
import type {
  Address,
  ClientParty,
  Invoice,
  PaymentDetails,
  SignatureBlock,
  SocialLinks,
} from "@/types/invoice";

export const filled = (value: string | null | undefined): boolean => !!value && value.trim() !== "";

export interface SocialEntry {
  key: keyof SocialLinks;
  label: string;
  value: string;
}

const SOCIAL_LABELS: Record<keyof SocialLinks, string> = {
  website: "Website",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  twitter: "X",
};

export function visibleSocialLinks(social: SocialLinks): SocialEntry[] {
  return (Object.keys(SOCIAL_LABELS) as (keyof SocialLinks)[])
    .filter((key) => filled(social[key]))
    .map((key) => ({ key, label: SOCIAL_LABELS[key], value: (social[key] as string).trim() }));
}

export function hasBankDetails(payment: PaymentDetails): boolean {
  const b = payment.bank;
  return [b.accountName, b.bankName, b.accountNumber, b.ifsc, b.branch].some(filled);
}

export function hasAnyPayment(invoice: Pick<Invoice, "payment">): boolean {
  const payment = invoice.payment;
  return (
    hasBankDetails(payment) ||
    filled(payment.upiId) ||
    filled(payment.paymentLink) ||
    filled(payment.paymentNote) ||
    hasPaymentQr(invoice)
  );
}

/**
 * Whether the invoice should print a pay-by-QR block. A generated code needs a
 * valid UPI ID, so the two inputs are checked together rather than trusting the
 * mode alone.
 */
export function hasPaymentQr(invoice: Pick<Invoice, "payment">): boolean {
  const { mode, imageUrl } = invoice.payment.qr;
  if (mode === "upload") return filled(imageUrl);
  if (mode === "upi") return isValidUpiHandle(invoice.payment.upiId);
  return false;
}

/** The logo actually printed: this invoice's own, else the saved business logo. */
export function resolveLogoUrl(invoice: Pick<Invoice, "logoOverrideUrl" | "business">): string {
  return filled(invoice.logoOverrideUrl) ? invoice.logoOverrideUrl.trim() : invoice.business.logoUrl.trim();
}

export function hasSignatureContent(signature: SignatureBlock): boolean {
  return filled(signature.imageUrl) || filled(signature.name) || filled(signature.designation);
}

export function hasAddress(address: Address): boolean {
  return [address.line1, address.line2, address.city, address.state, address.pincode].some(filled);
}

export function hasBusinessAddress(invoice: Invoice): boolean {
  return hasAddress(invoice.business.address);
}

export function hasClientAddress(invoice: Invoice): boolean {
  return hasAddress(invoice.client.billingAddress);
}

/** Client address actually printed: shipping only when it differs from billing. */
export function effectiveClientAddress(client: ClientParty): Address {
  return client.shipToSameAsBillTo ? client.billingAddress : client.shippingAddress;
}

export function hasTermsOrNotes(invoice: Invoice): boolean {
  return filled(invoice.terms) || filled(invoice.notes);
}

/** Key/value rows for a party block, pre-filtered so empty labels never render. */
export function partyLines(entries: [string, string][]): [string, string][] {
  return entries.filter(([, value]) => filled(value));
}

export function formatAddressLines(address: Address): string[] {
  const locality = [address.city, address.state, address.pincode].filter(filled).join(", ");
  return [address.line1, address.line2, locality].filter(filled);
}
