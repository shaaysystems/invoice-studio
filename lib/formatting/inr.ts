import { MINOR_PER_UNIT } from "@/lib/money";

const indianGrouping = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const indianPlain = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

export interface FormatMoneyOptions {
  /** Currency prefix. PDF export passes "Rs. " when the ₹ glyph is unavailable. */
  symbol?: string;
  /** Drop ".00" on whole amounts. */
  compactDecimals?: boolean;
}

/**
 * Canonical money formatter. Everything — editor, preview, PDF, JPEG and the
 * invoice list — routes through this function so amounts never disagree.
 */
export function formatINR(minor: number, options: FormatMoneyOptions = {}): string {
  const { symbol = "₹", compactDecimals = false } = options;
  const negative = minor < 0;
  const rupees = Math.abs(minor) / MINOR_PER_UNIT;
  let body = indianGrouping.format(rupees);
  if (compactDecimals && body.endsWith(".00")) body = body.slice(0, -3);
  return `${negative ? "-" : ""}${symbol}${body}`;
}

export function formatQuantity(quantity: number): string {
  return indianPlain.format(Number((quantity || 0).toFixed(3)));
}

export function formatPercent(percent: number): string {
  const rounded = Number((percent || 0).toFixed(2));
  return `${indianPlain.format(rounded)}%`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Formats `YYYY-MM-DD` without constructing a Date — no timezone drift. */
export function formatInvoiceDate(iso: string, style: "long" | "short" = "long"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  const monthName = MONTHS[month - 1] ?? "";
  if (style === "short") return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  return `${day} ${monthName} ${year}`;
}

/**
 * Same as `formatInvoiceDate`, but accepts a full ISO timestamp and keeps only
 * the calendar date the string already carries. Rendering it with `Date` or
 * `toLocaleDateString` would read the *runtime's* timezone, which differs
 * between the server and the visitor's browser.
 */
export function formatISODate(timestamp: string | null | undefined): string {
  if (!timestamp) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(timestamp);
  if (!match) return "";
  return formatInvoiceDate(match[1] ?? "", "long");
}

export function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const base = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(base)) return iso;
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/* ---------- Amount in words (Indian numbering system) ---------- */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] as string;
  const tens = TENS[Math.floor(n / 10)] as string;
  const ones = ONES[n % 10] as string;
  return ones ? `${tens} ${ones}` : tens;
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

export function amountToWordsINR(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const rupees = Math.floor(abs / MINOR_PER_UNIT);
  const paise = abs % MINOR_PER_UNIT;

  const segments: string[] = [];
  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1_000);
  const remainder = rupees % 1_000;

  if (crore) segments.push(`${threeDigits(crore)} Crore`);
  if (lakh) segments.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) segments.push(`${twoDigits(thousand)} Thousand`);
  if (remainder) segments.push(threeDigits(remainder));

  const rupeeWords = segments.length ? segments.join(" ") : "Zero";
  const paiseWords = paise ? ` and ${twoDigits(paise)} Paise` : "";
  return `${negative ? "Minus " : ""}${rupeeWords} Rupees${paiseWords} Only`;
}
