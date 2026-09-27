import {
  allocateProportionally,
  applyBasisPoints,
  clamp,
  multiplyQuantityPrice,
  percentToBasisPoints,
  roundHalfUp,
} from "@/lib/money";
import type {
  DiscountType,
  Invoice,
  InvoiceLineTotals,
  InvoiceTotals,
  TaxBucket,
} from "@/types/invoice";

/** One rupee, in paise — the granularity round-off snaps to. */
const RUPEE_MINOR = 100;

export function clampTaxRate(rate: number): number {
  return clamp(Number.isFinite(rate) ? rate : 0, 0, 100);
}

export function isGstActive(invoice: Invoice): boolean {
  return invoice.taxMode === "gst";
}

/** Resolves a line discount to paise. `amount` is paise; `percent` is a percentage. */
export function resolveDiscountMinor(
  type: DiscountType,
  value: number,
  baseMinor: number,
): number {
  if (type === "none" || baseMinor <= 0) return 0;
  if (type === "percent") {
    return applyBasisPoints(baseMinor, percentToBasisPoints(clamp(value, 0, 100)));
  }
  return clamp(Math.trunc(value), 0, baseMinor);
}

/**
 * Extracts tax already contained in a tax-inclusive amount.
 * Deriving `taxable` first and subtracting guarantees the parts re-sum exactly.
 */
export function extractInclusiveTax(netMinor: number, ratePct: number): {
  taxableMinor: number;
  taxMinor: number;
} {
  const rateBp = percentToBasisPoints(ratePct);
  if (rateBp <= 0) return { taxableMinor: netMinor, taxMinor: 0 };
  const taxableMinor = clamp(
    roundHalfUp((netMinor * 10_000) / (10_000 + rateBp)),
    0,
    netMinor,
  );
  return { taxableMinor, taxMinor: netMinor - taxableMinor };
}

/** CGST + SGST or IGST, chosen by supply scope. Halving the total keeps them exact. */
export function splitGst(
  taxMinor: number,
  scope: Invoice["gstScope"],
): { cgstMinor: number; sgstMinor: number; igstMinor: number } {
  if (taxMinor === 0) return { cgstMinor: 0, sgstMinor: 0, igstMinor: 0 };
  if (scope === "inter") return { cgstMinor: 0, sgstMinor: 0, igstMinor: taxMinor };
  const cgstMinor = Math.floor(taxMinor / 2);
  return { cgstMinor, sgstMinor: taxMinor - cgstMinor, igstMinor: 0 };
}

/** Nearest rupee difference, always carrying its sign. */
export function roundOffMinor(preRoundMinor: number): number {
  const target = Math.round(preRoundMinor / RUPEE_MINOR) * RUPEE_MINOR;
  return target - preRoundMinor;
}

export function calculateInvoiceTotals(invoice: Invoice): InvoiceTotals {
  const gst = isGstActive(invoice);

  // --- 1. Line gross amounts and line-level discounts ---
  // `item.quantity` is already scaled by QTY_SCALE, so it goes straight into
  // `multiplyQuantityPrice` — scaling it again here would inflate every line.
  const gross = invoice.items.map((item) =>
    multiplyQuantityPrice(Math.max(0, Math.trunc(item.quantity || 0)), Math.max(0, Math.trunc(item.rateMinor || 0))),
  );

  const lineDiscounts = invoice.items.map((item, index) =>
    resolveDiscountMinor(item.discountType, item.discountValue, gross[index] as number),
  );

  const netAfterLine = gross.map((g, index) => (g as number) - (lineDiscounts[index] as number));
  const subtotalMinor = gross.reduce((sum, value) => sum + value, 0);
  const lineDiscountMinor = lineDiscounts.reduce((sum, value) => sum + value, 0);

  // --- 2. Global discount, spread proportionally so the parts sum exactly ---
  const globalBase = netAfterLine.reduce((sum, value) => sum + Math.max(0, value), 0);
  const globalDiscountMinor = Math.min(
    resolveDiscountMinor(invoice.globalDiscountType, invoice.globalDiscountValue, globalBase),
    globalBase,
  );
  const globalShares = allocateProportionally(
    globalDiscountMinor,
    netAfterLine.map((value) => Math.max(0, value)),
  );

  // --- 3. Taxable value and tax per line ---
  const rates = invoice.items.map((item) => (gst ? clampTaxRate(item.taxRate) : 0));

  const lines: InvoiceLineTotals[] = invoice.items.map((item, index) => {
    const grossMinor = gross[index] as number;
    const discountMinor = (lineDiscounts[index] as number) + (globalShares[index] as number);
    const netMinor = grossMinor - discountMinor;
    const rate = rates[index] as number;

    const { taxableMinor, taxMinor } =
      gst && rate > 0 && invoice.pricesIncludeTax
        ? extractInclusiveTax(netMinor, rate)
        : {
            taxableMinor: netMinor,
            taxMinor: gst && rate > 0 ? applyBasisPoints(netMinor, percentToBasisPoints(rate)) : 0,
          };

    const parts = splitGst(taxMinor, invoice.gstScope);

    return {
      lineId: item.id,
      grossMinor,
      discountMinor,
      taxableMinor,
      taxMinor,
      ...parts,
      totalMinor: taxableMinor + taxMinor,
    };
  });

  const sum = (pick: (line: InvoiceLineTotals) => number) =>
    lines.reduce((acc, line) => acc + pick(line), 0);

  const taxableMinor = sum((l) => l.taxableMinor);
  const cgstMinor = sum((l) => l.cgstMinor);
  const sgstMinor = sum((l) => l.sgstMinor);
  const igstMinor = sum((l) => l.igstMinor);
  const taxMinor = sum((l) => l.taxMinor);

  // --- 4. Shipping, then round-off, then the payable grand total ---
  const shippingMinor = Math.max(0, Math.trunc(invoice.shippingMinor || 0));
  const preRoundMinor = taxableMinor + taxMinor + shippingMinor;
  const roundOff = invoice.roundOffEnabled ? roundOffMinor(preRoundMinor) : 0;

  // --- 5. Rate-wise buckets for the GST summary ---
  const byRate = new Map<number, TaxBucket>();
  lines.forEach((line, index) => {
    const rate = rates[index] as number;
    if (rate <= 0) return;
    const bucket =
      byRate.get(rate) ?? { rate, taxableMinor: 0, cgstMinor: 0, sgstMinor: 0, igstMinor: 0 };
    bucket.taxableMinor += line.taxableMinor;
    bucket.cgstMinor += line.cgstMinor;
    bucket.sgstMinor += line.sgstMinor;
    bucket.igstMinor += line.igstMinor;
    byRate.set(rate, bucket);
  });

  return {
    lines,
    subtotalMinor,
    lineDiscountMinor,
    globalDiscountMinor,
    taxableMinor,
    cgstMinor,
    sgstMinor,
    igstMinor,
    taxMinor,
    shippingMinor,
    roundOffMinor: roundOff,
    grandTotalMinor: preRoundMinor + roundOff,
    buckets: [...byRate.values()].sort((a, b) => a.rate - b.rate),
  };
}

export function lineTotalsFor(
  totals: InvoiceTotals,
  lineId: string,
): InvoiceLineTotals | undefined {
  return totals.lines.find((line) => line.lineId === lineId);
}
