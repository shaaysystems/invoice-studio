import {
  hasAnyPayment,
  hasBankDetails,
  hasSignatureContent,
  partyLines,
} from "@/lib/invoice/presence";
import { usePaymentQr } from "@/lib/payment/use-payment-qr";
import type { InvoiceTokens } from "@/lib/brand/tokens";
import type { Invoice, InvoiceTotals } from "@/types/invoice";
import { SafeImage, SectionLabel, TextLine } from "./primitives";
import { PaymentQrBlock } from "./PaymentQrBlock";

interface BaseProps {
  invoice: Invoice;
  tokens: InvoiceTokens;
}

interface Props extends BaseProps {
  /** Grand total, needed to embed the amount in a generated QR code. */
  totals: Pick<InvoiceTotals, "grandTotalMinor">;
}

/** Blank-line-free paragraphs, so authored newlines still read as a list. */
function textLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function PaymentAndTerms({ invoice, tokens, totals }: Props) {
  const showPayment = hasAnyPayment(invoice);
  const qr = usePaymentQr(invoice, totals);
  const terms = textLines(invoice.terms);
  const note = invoice.notes.trim();
  const showTerms = terms.length > 0 || note !== "";

  if (!showPayment && !showTerms) return null;

  const bank = partyLines([
    ["Account name", invoice.payment.bank.accountName],
    ["Bank", invoice.payment.bank.bankName],
    ["Account no.", invoice.payment.bank.accountNumber],
    ["IFSC", invoice.payment.bank.ifsc],
    ["Branch", invoice.payment.bank.branch],
  ]);

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: showPayment && showTerms ? "1fr 1fr" : "1fr",
        gap: "20pt",
        marginTop: "18pt",
        paddingTop: "13pt",
        borderTop: `0.75pt solid ${tokens.rule}`,
      }}
    >
      {showPayment ? (
        <div style={{ minWidth: 0, display: "flex", gap: "14pt", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <SectionLabel color={tokens.inkSubtle}>Payment details</SectionLabel>
          {hasBankDetails(invoice.payment)
            ? bank.map(([label, value]) => (
                <div key={label} style={{ display: "flex", gap: "5pt", marginBottom: "1.6pt" }}>
                  <span
                    className="tracked-label"
                    style={{ color: tokens.inkSubtle, fontSize: "6.6pt", width: "52pt", flexShrink: 0, paddingTop: "1pt" }}
                  >
                    {label}
                  </span>
                  <span style={{ color: tokens.ink, fontSize: "8.2pt", wordBreak: "break-word" }}>{value}</span>
                </div>
              ))
            : null}

          {invoice.payment.upiId.trim() ? (
            <div
              style={{
                marginTop: "6pt",
                display: "inline-block",
                padding: "3pt 8pt",
                borderRadius: "3pt",
                backgroundColor: tokens.accentSoft,
                color: tokens.ink,
                fontSize: "8.2pt",
                fontWeight: 600,
              }}
            >
              UPI · {invoice.payment.upiId}
            </div>
          ) : null}

          {invoice.payment.paymentLink.trim() ? (
            <div style={{ marginTop: "6pt" }}>
              <span className="tracked-label" style={{ color: tokens.inkSubtle, fontSize: "6.6pt" }}>
                Pay online
              </span>
              <div style={{ color: tokens.ink, fontSize: "8.2pt", wordBreak: "break-all" }}>
                {invoice.payment.paymentLink}
              </div>
            </div>
          ) : null}

          {invoice.payment.paymentNote.trim() ? (
            <div style={{ marginTop: "6pt" }}>
              <span className="tracked-label" style={{ color: tokens.inkSubtle, fontSize: "6.6pt" }}>
                Note
              </span>
              <div style={{ color: tokens.inkMuted, fontSize: "8pt" }}>{invoice.payment.paymentNote}</div>
            </div>
          ) : null}
          </div>

          {qr ? <PaymentQrBlock qr={qr} tokens={tokens} /> : null}
        </div>
      ) : null}

      {showTerms ? (
        <div style={{ minWidth: 0 }}>
          {terms.length ? (
            <>
              <SectionLabel color={tokens.inkSubtle}>Terms &amp; conditions</SectionLabel>
              <ol style={{ margin: 0, paddingLeft: "12pt" }}>
                {terms.map((term, index) => (
                  <li
                    key={`${index}-${term.slice(0, 12)}`}
                    style={{ color: tokens.inkMuted, fontSize: "7.9pt", lineHeight: 1.45, marginBottom: "2pt", wordBreak: "break-word" }}
                  >
                    {term}
                  </li>
                ))}
              </ol>
            </>
          ) : null}

          {note ? (
            <div style={{ marginTop: terms.length ? "9pt" : 0 }}>
              <TextLine value={note} color={tokens.ink} size={8.4} weight={500} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function SignatureBlockView({ invoice, tokens }: BaseProps) {
  if (!hasSignatureContent(invoice.signature)) return null;
  const { signature } = invoice;

  return (
    <section style={{ display: "flex", justifyContent: "flex-end", marginTop: "18pt" }}>
      <div style={{ textAlign: "right", minWidth: "132pt" }}>
        {signature.imageUrl ? (
          <SafeImage
            src={signature.imageUrl}
            maxWidth={124}
            maxHeight={34}
            alt="Authorised signature"
            align="right"
          />
        ) : (
          <div style={{ height: "24pt" }} />
        )}
        <div style={{ marginTop: "3pt", borderTop: `0.75pt solid ${tokens.ruleStrong}`, paddingTop: "4pt" }}>
          <TextLine value={signature.name} color={tokens.ink} size={8.8} weight={600} className="text-right" />
          <TextLine value={signature.designation} color={tokens.inkMuted} size={7.8} className="text-right" />
        </div>
      </div>
    </section>
  );
}

export function InvoicePageFooter({
  tokens,
  pageNumber,
  pageCount,
  businessName,
}: {
  tokens: InvoiceTokens;
  pageNumber: number;
  pageCount: number;
  businessName: string;
}) {
  return (
    <footer
      style={{
        marginTop: "auto",
        paddingTop: "9pt",
        borderTop: `0.5pt solid ${tokens.rule}`,
        display: "flex",
        justifyContent: "space-between",
        color: tokens.inkSubtle,
        fontSize: "6.9pt",
      }}
    >
      <span>{businessName}</span>
      {/* Page numbers appear only on multi-page documents. */}
      {pageCount > 1 ? <span className="tabular">Page {pageNumber} of {pageCount}</span> : <span />}
    </footer>
  );
}
