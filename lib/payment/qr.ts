import { encode } from "uqr";
import { formatINR } from "@/lib/formatting/inr";
import { hasPaymentQr } from "@/lib/invoice/presence";
import { buildUpiPaymentUri } from "./upi";
import type { Invoice, InvoiceTotals } from "@/types/invoice";

/**
 * The payment QR is resolved in exactly one place, because the live preview,
 * the PDF and the JPEG export must all print the same code. A PNG data URL is
 * produced rather than SVG so that react-pdf embeds it without a rasteriser.
 */

export const QR_EDGE_PX = 512; // 4x the 128pt print size, for print and zoom
const QUIET_ZONE = 4; // QR spec: four modules of margin, or scanners struggle

export interface ResolvedPaymentQr {
  /** PNG data URL, or a storage/data URL for an uploaded image. */
  src: string;
  label: string;
  /** Amount printed under the code. Empty when there is nothing to show. */
  amountText: string;
  /** True when the code was generated here rather than uploaded. */
  generated: boolean;
}

/** Encoded payload behind the printed code — also handy for tests and debugging. */
export function paymentQrPayload(
  invoice: Invoice,
  totals: Pick<InvoiceTotals, "balanceDueMinor">,
): string | null {
  const { qr, upiId } = invoice.payment;
  if (qr.mode === "none") return null;
  if (qr.mode === "upload") return null;
  return buildUpiPaymentUri({
    upiId,
    payeeName: invoice.business.name,
    amountMinor: qr.includeAmount ? totals.balanceDueMinor : null,
    note: invoice.number ? `Invoice ${invoice.number}` : "",
  });
}

/**
 * Matrix → PNG data URL. Cached by payload because the preview re-renders on
 * every keystroke and re-rasterising the same code each time is wasted work.
 */
const cache = new Map<string, string>();

export function qrPngDataUrl(payload: string, edgePx: number = QR_EDGE_PX): string {
  const cacheKey = `${payload}@${edgePx}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // "M" tolerates a 15% smudge, which covers a printed code catching a fold.
  const { data, size } = encode(payload, { ecc: "M", border: 0 });
  const total = size + QUIET_ZONE * 2;
  // Whole pixels per module only — rounding down on a fractional module blurs
  // the finder patterns and costs scan reliability.
  const modulePx = Math.max(1, Math.floor(edgePx / total));
  const canvasPx = modulePx * total;

  const canvas = document.createElement("canvas");
  canvas.width = canvasPx;
  canvas.height = canvasPx;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable, so the QR code cannot be drawn.");

  // Light background first: transparent modules scan as black on dark readers.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvasPx, canvasPx);
  context.fillStyle = "#000000";
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (data[row]?.[col]) {
        context.fillRect((col + QUIET_ZONE) * modulePx, (row + QUIET_ZONE) * modulePx, modulePx, modulePx);
      }
    }
  }

  const url = canvas.toDataURL("image/png");
  cache.set(cacheKey, url);
  return url;
}

/** Returns null whenever the invoice should print no code at all. */
export function resolvePaymentQr(
  invoice: Invoice,
  totals: Pick<InvoiceTotals, "balanceDueMinor">,
): ResolvedPaymentQr | null {
  const { qr } = invoice.payment;
  if (!hasPaymentQr(invoice)) return null;

  const label = qr.label.trim();
  if (qr.mode === "upload") {
    return {
      src: qr.imageUrl.trim(),
      label,
      amountText: "",
      generated: false,
    };
  }

  const payload = paymentQrPayload(invoice, totals);
  if (!payload) return null;

  // A generated code needs a canvas. On the server there is none, so nothing is
  // printed there; the browser fills it in after mount via `usePaymentQr`.
  if (typeof document === "undefined") return null;

  return {
    src: qrPngDataUrl(payload),
    label,
    amountText: qr.includeAmount ? formatINR(totals.balanceDueMinor, { compactDecimals: true }) : "",
    generated: true,
  };
}
