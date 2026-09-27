import { amountToWordsINR, formatINR, formatPercent } from "@/lib/formatting/inr";
import type { InvoiceTokens } from "@/lib/brand/tokens";
import type { Invoice, InvoiceTotals as Totals } from "@/types/invoice";

interface Props {
  invoice: Invoice;
  totals: Totals;
  tokens: InvoiceTokens;
}

function Row({
  label,
  value,
  tokens,
  strong,
}: {
  label: string;
  value: string;
  tokens: InvoiceTokens;
  strong?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "12pt", padding: "2.6pt 0" }}>
      <span style={{ color: strong ? tokens.ink : tokens.inkMuted, fontSize: "8.4pt", fontWeight: strong ? 600 : 400 }}>
        {label}
      </span>
      <span className="tabular" style={{ color: tokens.ink, fontSize: "8.8pt", fontWeight: strong ? 600 : 500 }}>
        {value}
      </span>
    </div>
  );
}

export function InvoiceTotalsBlock({ invoice, totals, tokens }: Props) {
  const isGst = invoice.taxMode === "gst";
  const isIntra = invoice.gstScope === "intra";
  const mixedRates = totals.buckets.length > 1;

  const discountLabel =
    invoice.globalDiscountType === "percent"
      ? `Discount (${formatPercent(invoice.globalDiscountValue)})`
      : "Discount";

  return (
    <section data-totals-block style={{ display: "flex", justifyContent: "flex-end", marginTop: "16pt" }}>
      <div style={{ width: "252pt", maxWidth: "100%" }}>
        <Row label="Subtotal" value={formatINR(totals.subtotalMinor)} tokens={tokens} />

        {totals.lineDiscountMinor > 0 ? (
          <Row label="Item discount" value={`- ${formatINR(totals.lineDiscountMinor)}`} tokens={tokens} />
        ) : null}

        {totals.globalDiscountMinor > 0 ? (
          <Row label={discountLabel} value={`- ${formatINR(totals.globalDiscountMinor)}`} tokens={tokens} />
        ) : null}

        {isGst ? <Row label="Taxable value" value={formatINR(totals.taxableMinor)} tokens={tokens} /> : null}

        {isGst
          ? totals.buckets.map((bucket) => {
              const suffix = mixedRates ? ` @ ${formatPercent(bucket.rate)}` : ` ${formatPercent(bucket.rate)}`;
              if (isIntra) {
                return (
                  <div key={bucket.rate}>
                    <Row label={`CGST${suffix}`} value={formatINR(bucket.cgstMinor)} tokens={tokens} />
                    <Row label={`SGST${suffix}`} value={formatINR(bucket.sgstMinor)} tokens={tokens} />
                  </div>
                );
              }
              return <Row key={bucket.rate} label={`IGST${suffix}`} value={formatINR(bucket.igstMinor)} tokens={tokens} />;
            })
          : null}

        {totals.shippingMinor > 0 ? (
          <Row label="Shipping" value={formatINR(totals.shippingMinor)} tokens={tokens} />
        ) : null}

        {totals.roundOffMinor !== 0 ? (
          <Row
            label="Round off"
            value={`${totals.roundOffMinor > 0 ? "+" : "-"} ${formatINR(Math.abs(totals.roundOffMinor))}`}
            tokens={tokens}
          />
        ) : null}

        {/* Grand total — the largest number on the page. */}
        <div
          style={{
            marginTop: "9pt",
            padding: "11pt 13pt",
            borderRadius: "4pt",
            backgroundColor: tokens.totalBg,
            color: tokens.totalInk,
          }}
        >
          <div className="tracked-label" style={{ fontSize: "6.9pt", fontWeight: 600, opacity: 0.82 }}>
            Total due
          </div>
          <div
            className="tabular"
            style={{ fontSize: "22pt", fontWeight: 700, lineHeight: 1.12, letterSpacing: "-0.015em" }}
          >
            {formatINR(totals.grandTotalMinor)}
          </div>
        </div>

        {invoice.amountInWordsEnabled ? (
          <div style={{ marginTop: "7pt", color: tokens.inkMuted, fontSize: "7.6pt", lineHeight: 1.4 }}>
            <span className="tracked-label" style={{ fontSize: "6.6pt", color: tokens.inkSubtle }}>
              In words
            </span>
            <div>{amountToWordsINR(totals.grandTotalMinor)}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
