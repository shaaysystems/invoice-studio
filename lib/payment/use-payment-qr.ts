"use client";

import { useEffect, useState } from "react";
import { resolvePaymentQr, type ResolvedPaymentQr } from "./qr";
import type { Invoice, InvoiceTotals } from "@/types/invoice";

/**
 * Resolves the payment QR in the browser only.
 *
 * Generating a code needs a canvas, which does not exist during server
 * rendering. Resolving after mount also keeps the server and client markup
 * identical on first paint — a code that appeared only on the client would
 * trip React's hydration check. The cost is one paint without the code, which
 * is invisible at preview scale.
 */
export function usePaymentQr(
  invoice: Invoice,
  totals: Pick<InvoiceTotals, "balanceDueMinor">,
): ResolvedPaymentQr | null {
  const [qr, setQr] = useState<ResolvedPaymentQr | null>(null);

  useEffect(() => {
    setQr(resolvePaymentQr(invoice, totals));
  }, [invoice, totals]);

  return qr;
}
