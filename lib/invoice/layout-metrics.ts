import type { Invoice, InvoiceTotals } from "@/types/invoice";
import {
  effectiveClientAddress,
  filled,
  formatAddressLines,
  hasAnyPayment,
  hasBusinessAddress,
  hasClientAddress,
  hasPaymentQr,
  hasSignatureContent,
  hasTermsOrNotes,
  resolveLogoUrl,
} from "./presence";
import { FOOTER_TEXT_ROW_HEIGHT, SOCIAL_FOOTER_ROW_HEIGHT, SOCIAL_ROW_HEIGHT, clickableSocials } from "./social-links";

export const PAGE = {
  width: 595.28,
  height: 841.89,
  padX: 44,
  padTop: 40,
  padBottom: 32,
} as const;

export const CONTENT_WIDTH = PAGE.width - PAGE.padX * 2; // 507.28
export const CONTENT_HEIGHT = PAGE.height - PAGE.padTop - PAGE.padBottom;

export const TYPE = {
  micro: 6.8,
  label: 7.4,
  small: 8.2,
  body: 9.2,
  mid: 11,
  lead: 13,
  title: 30,
  total: 22,
} as const;

export const ROW = {
  headerHeight: 21,
  basePadding: 7,
  descLineHeight: 10.2,
  minHeight: 26,
} as const;

export const FOOTER_HEIGHT = 22;
/**
 * How much taller the footer row gets when a `footer`-scale icon box shares it
 * with the 6.9pt business name. Derived rather than guessed, so the two cannot
 * disagree if the preset size changes.
 */
export const SOCIAL_FOOTER_ROW_GROWTH = Math.max(
  0,
  SOCIAL_FOOTER_ROW_HEIGHT - FOOTER_TEXT_ROW_HEIGHT,
);
export const BLOCK_GAP = 16;

/**
 * Bounding box for the client logo in the "Bill to" block. It sits beside the
 * client name, so the block only grows when the name wraps — hence the separate
 * height term in `measurePartiesBlock` rather than a whole extra line.
 */
export const CLIENT_LOGO = { width: 44, height: 30 } as const;

/** Printed size of the pay-by-QR code, and the box it occupies. */
export const QR_SIZE = 84;
export const QR_BLOCK_HEIGHT = QR_SIZE + 30; // code + caption + amount line

/** Header shown on continuation pages: compact identity + "continued" marker. */
export const CONTINUATION_HEADER_HEIGHT = 46;

export interface ColumnWidths {
  index: number;
  description: number;
  hsn: number;
  qty: number;
  unit: number;
  rate: number;
  taxPct: number;
  amount: number;
}

export interface TableLayout {
  columns: ColumnWidths;
  showHsn: boolean;
  showTaxColumn: boolean;
  showUnit: boolean;
}

export function computeTableLayout(invoice: Invoice): TableLayout {
  const showHsn = invoice.taxMode === "gst" && invoice.items.some((i) => i.hsn.trim() !== "");
  const rates = new Set(invoice.items.map((i) => i.taxRate));
  const showTaxColumn = invoice.taxMode === "gst" && rates.size > 1;
  const showUnit = invoice.items.some((i) => i.unit.trim() !== "" && i.unit !== "pcs");

  const index = 20;
  const hsn = showHsn ? 46 : 0;
  const qty = 40;
  const unit = showUnit ? 38 : 0;
  const rate = 74;
  const taxPct = showTaxColumn ? 40 : 0;
  const amount = 84;
  const description = CONTENT_WIDTH - (index + hsn + qty + unit + rate + taxPct + amount);

  return { columns: { index, description, hsn, qty, unit, rate, taxPct, amount }, showHsn, showTaxColumn, showUnit };
}

/** Conservative character-per-line estimate for the description column. */
export function estimateLines(text: string, widthPt: number, fontSizePt: number): number {
  if (!text.trim()) return 0;
  const avgCharWidth = fontSizePt * 0.505; // Inter/Helvetica lowercase average
  const perLine = Math.max(8, Math.floor(widthPt / avgCharWidth));
  return text
    .split("\n")
    .reduce((lines, paragraph) => lines + Math.max(1, Math.ceil(paragraph.trim().length / perLine)), 0);
}

export function measureItemRow(item: { description: string }, layout: TableLayout): number {
  const lines = Math.max(1, estimateLines(item.description, layout.columns.description - 2, TYPE.body));
  return Math.max(ROW.minHeight, Math.ceil(ROW.basePadding * 2 + lines * ROW.descLineHeight));
}

function countFilled(values: (string | undefined)[]): number {
  return values.filter((v) => filled(v)).length;
}

/* ---------- Block heights ---------- */

export function measureIdentityHeader(invoice: Invoice): number {
  const logoHeight = invoice.brand.showLogo && filled(resolveLogoUrl(invoice)) ? 46 : 0;
  const identityLines = countFilled([
    invoice.business.name,
    invoice.business.legalName && invoice.business.legalName !== invoice.business.name
      ? invoice.business.legalName
      : "",
    invoice.business.gstin,
  ]);
  const left = logoHeight + identityLines * 12 + 8;
  const right = TYPE.title + 22; // "INVOICE" + number pill
  return Math.ceil(Math.max(left, right) + BLOCK_GAP);
}

export function measurePartiesBlock(invoice: Invoice): number {
  const businessLines = countFilled([
    hasBusinessAddress(invoice) ? invoice.business.address.line1 : "",
    hasBusinessAddress(invoice) ? invoice.business.address.line2 : "",
    hasBusinessAddress(invoice)
      ? [invoice.business.address.city, invoice.business.address.state, invoice.business.address.pincode]
          .filter(filled)
          .join(", ")
      : "",
    invoice.business.gstin,
    invoice.business.pan,
    invoice.business.phone,
    invoice.business.email,
  ]);

  // The social profiles print as one fixed-height icon strip, not as text, so
  // they contribute a flat term instead of a line each.
  const socialRowHeight = clickableSocials(invoice.business.socials).length ? SOCIAL_ROW_HEIGHT : 0;

  const clientAddress = effectiveClientAddress(invoice.client);
  const clientLines = countFilled([
    invoice.client.gstin,
    invoice.client.pan,
    invoice.client.phone,
    invoice.client.email,
    hasClientAddress(invoice) ? invoice.client.billingAddress.line1 : "",
    hasClientAddress(invoice) ? invoice.client.billingAddress.line2 : "",
    hasClientAddress(invoice) ? formatAddressLines(invoice.client.billingAddress).slice(-1)[0] : "",
    !invoice.client.shipToSameAsBillTo ? "ship" : "",
    clientAddress !== invoice.client.billingAddress ? "ship-line" : "",
  ]);

  const metaLines = countFilled([
    invoice.issueDate,
    invoice.dueDate,
    invoice.poNumber,
    invoice.taxMode === "gst" ? invoice.placeOfSupply : "",
  ]);

  // The client logo shares a row with the client name, so it reserves its own
  // height on top of the text lines rather than counting as another line.
  const clientLogoHeight = filled(invoice.client.logoUrl) ? CLIENT_LOGO.height : 0;
  const tallestPt = Math.max(
    businessLines * 11.4 + socialRowHeight,
    clientLines * 11.4 + clientLogoHeight,
    metaLines * 2 * 11.4,
  );
  return Math.ceil(14 + 16 + tallestPt + BLOCK_GAP);
}

export function measureTotalsBlock(invoice: Invoice, totals: InvoiceTotals): number {
  let rows = 1; // subtotal
  if (totals.lineDiscountMinor > 0) rows += 1;
  if (totals.globalDiscountMinor > 0) rows += 1;
  if (invoice.taxMode === "gst") {
    rows += 1; // taxable value
    rows += totals.buckets.length * (invoice.gstScope === "intra" ? 2 : 1);
  }
  if (totals.shippingMinor > 0) rows += 1;
  if (totals.roundOffMinor !== 0) rows += 1;
  // A recorded advance adds a "Total" line and an "Advance paid" line above
  // the big box, which then reads "Balance due".
  if (totals.advanceMinor > 0) rows += 2;
  const wordsHeight = invoice.amountInWordsEnabled ? 26 : 0;
  return Math.ceil(rows * 14 + 56 + wordsHeight + BLOCK_GAP);
}

export function measurePaymentBlock(invoice: Invoice): number {
  if (!hasAnyPayment(invoice)) return 0;
  const bankLines = countFilled([
    invoice.payment.bank.accountName,
    invoice.payment.bank.accountNumber,
    invoice.payment.bank.ifsc,
    invoice.payment.bank.bankName,
    invoice.payment.bank.branch,
    invoice.payment.upiId,
  ]);
  const linkLines = countFilled([invoice.payment.paymentLink, invoice.payment.paymentNote]);
  // The code sits beside the bank details, so only a QR taller than the text
  // column grows the block.
  const qrHeight = hasPaymentQr(invoice) ? Math.max(0, QR_BLOCK_HEIGHT - (bankLines + linkLines) * 11.4) : 0;
  return Math.ceil(16 + (bankLines + linkLines) * 11.4 + qrHeight + BLOCK_GAP);
}

export function measureTermsBlock(invoice: Invoice): number {
  if (!hasTermsOrNotes(invoice)) return 0;
  const width = CONTENT_WIDTH * 0.56;
  const termLines = estimateLines(invoice.terms, width, TYPE.small);
  const noteLines = estimateLines(invoice.notes, width, TYPE.small);
  return Math.ceil(16 + (termLines + noteLines) * 11 + BLOCK_GAP);
}

export function measureSignatureBlock(invoice: Invoice): number {
  if (!hasSignatureContent(invoice.signature)) return 0;
  const imageHeight = filled(invoice.signature.imageUrl) ? 38 : 0;
  const textLines = countFilled([invoice.signature.name, invoice.signature.designation]);
  return Math.ceil(imageHeight + textLines * 11.4 + 14 + BLOCK_GAP);
}

/**
 * The footer row is one line of 6.9pt text, or one `footer`-scale icon box
 * when the business has profiles to link. The taller of the two has to be
 * reserved before painting, or the last page overflows.
 */
export function measureFooter(invoice: Invoice): number {
  const hasIcons = clickableSocials(invoice.business.socials).length > 0;
  return FOOTER_HEIGHT + (hasIcons ? SOCIAL_FOOTER_ROW_GROWTH : 0);
}

export interface InvoiceMetrics {
  table: TableLayout;
  identityHeaderHeight: number;
  partiesHeight: number;
  totalsHeight: number;
  paymentHeight: number;
  termsHeight: number;
  signatureHeight: number;
  footerHeight: number;
  tailHeight: number;
  rowHeights: number[];
}

/** One measurement pass reused by the paginator and both renderers. */
export function computeInvoiceMetrics(invoice: Invoice, totals: InvoiceTotals): InvoiceMetrics {
  const table = computeTableLayout(invoice);
  const totalsHeight = measureTotalsBlock(invoice, totals);
  const paymentHeight = measurePaymentBlock(invoice);
  const termsHeight = measureTermsBlock(invoice);
  const signatureHeight = measureSignatureBlock(invoice);

  return {
    table,
    identityHeaderHeight: measureIdentityHeader(invoice),
    partiesHeight: measurePartiesBlock(invoice),
    totalsHeight,
    paymentHeight,
    termsHeight,
    signatureHeight,
    footerHeight: measureFooter(invoice),
    // Terms and payment sit side-by-side when both are short.
    tailHeight: totalsHeight + Math.max(paymentHeight, termsHeight) + signatureHeight,
    rowHeights: invoice.items.map((item) => measureItemRow(item, table)),
  };
}
