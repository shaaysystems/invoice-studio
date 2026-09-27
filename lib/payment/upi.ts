import { MINOR_PER_UNIT } from "@/lib/money";

/**
 * UPI deep links, as every Indian UPI app understands them:
 * `upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<note>`
 *
 * A payer who scans the code lands in their own UPI app with the amount and
 * invoice reference already filled in, which is the whole point of printing the
 * code on the invoice.
 */

export interface UpiPaymentParams {
  /** Virtual Payment Address, e.g. `northstar@okhdfcbank`. */
  upiId: string;
  /** Payee name shown in the payer's app. */
  payeeName?: string;
  /** Grand total in paise. Left out of the link when null or non-positive. */
  amountMinor?: number | null;
  /** Usually the invoice number, so the payer can reference it. */
  note?: string;
}

/** Plain decimal rupees — no symbol, no grouping, never exponent notation. */
export function formatUpiAmount(amountMinor: number): string {
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return "";
  return (amountMinor / MINOR_PER_UNIT).toFixed(2);
}

/** A VPA is `handle@bank`; anything else would produce an unscannable code. */
export function isValidUpiHandle(upiId: string): boolean {
  return /^[\w.\-]{2,256}@[\w.\-]{2,64}$/.test(upiId.trim());
}

/**
 * Percent-encodes a free-text field. `encodeURIComponent` is used directly
 * rather than URLSearchParams because the latter emits `+` for spaces, which
 * some UPI apps show literally in the payee name and note.
 */
function encodeField(value: string, maxLength: number): string {
  const printable = Array.from(value)
    // Control characters have no place in a payee name or note.
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 0x20 || code === 0x7f ? " " : char;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return encodeURIComponent(printable);
}

/** Returns null when there is no usable VPA, so callers can skip the QR entirely. */
export function buildUpiPaymentUri(params: UpiPaymentParams): string | null {
  const vpa = params.upiId.trim();
  if (!isValidUpiHandle(vpa)) return null;

  const parts = [`pa=${encodeURIComponent(vpa)}`];

  const payeeName = params.payeeName?.trim();
  if (payeeName) parts.push(`pn=${encodeField(payeeName, 50)}`);

  const amount = params.amountMinor == null ? "" : formatUpiAmount(params.amountMinor);
  if (amount) parts.push(`am=${amount}`);

  parts.push("cu=INR");

  const note = params.note?.trim();
  if (note) parts.push(`tn=${encodeField(note, 50)}`);

  return `upi://pay?${parts.join("&")}`;
}
