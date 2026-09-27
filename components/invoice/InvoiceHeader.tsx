import { formatInvoiceDate } from "@/lib/formatting/inr";
import { resolveLogoUrl } from "@/lib/invoice/presence";
import type { InvoiceTokens } from "@/lib/brand/tokens";
import type { Invoice } from "@/types/invoice";
import { SafeImage, TextLine } from "./primitives";

interface Props {
  invoice: Invoice;
  tokens: InvoiceTokens;
}

/**
 * Identity zone. When a logo exists it anchors the left column; otherwise the
 * business name becomes the visual anchor and the space collapses.
 */
export function InvoiceHeader({ invoice, tokens }: Props) {
  const { business, brand, number, dueDate } = invoice;
  const logoUrl = resolveLogoUrl(invoice);
  const showLogo = brand.showLogo && !!logoUrl;

  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24pt" }}>
      <div style={{ minWidth: 0, flex: "1 1 auto" }}>
        {showLogo ? (
          <SafeImage src={logoUrl} maxWidth={150} maxHeight={44} alt={`${business.name} logo`} />
        ) : null}

        <div style={{ marginTop: showLogo ? "9pt" : 0 }}>
          <TextLine
            value={business.name || "Your business name"}
            color={business.name ? tokens.ink : tokens.inkSubtle}
            size={showLogo ? 11.5 : 15}
            weight={700}
          />
          {business.legalName && business.legalName !== business.name ? (
            <TextLine value={business.legalName} color={tokens.inkMuted} size={8.2} />
          ) : null}
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            color: tokens.titleColor,
            fontSize: "30pt",
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          Invoice
        </div>

        {number ? (
          <div
            style={{
              display: "inline-block",
              marginTop: "7pt",
              padding: "3.5pt 9pt",
              borderRadius: "999pt",
              backgroundColor: tokens.numberPillBg,
              color: tokens.numberPillInk,
              fontSize: "9pt",
              fontWeight: 600,
              letterSpacing: "0.03em",
            }}
          >
            {number}
          </div>
        ) : null}

        {brand.accentBarEnabled ? (
          <div
            style={{
              marginTop: "9pt",
              marginLeft: "auto",
              width: "52pt",
              height: "2pt",
              backgroundColor: tokens.accent,
            }}
          />
        ) : null}

        {dueDate ? (
          <div style={{ marginTop: "7pt", color: tokens.inkMuted, fontSize: "7.8pt" }}>
            Payment due {formatInvoiceDate(dueDate)}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Compact header repeated on continuation pages. */
export function ContinuationHeader({ invoice, tokens }: Props) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        paddingBottom: "8pt",
        borderBottom: `0.75pt solid ${tokens.rule}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: tokens.ink, fontSize: "9.5pt", fontWeight: 600 }}>
          {invoice.business.name || "Invoice"}
        </div>
        <div style={{ color: tokens.inkSubtle, fontSize: "7.4pt" }}>
          Invoice {invoice.number} — continued
        </div>
      </div>
      <div style={{ color: tokens.inkMuted, fontSize: "7.8pt" }}>{invoice.client.name}</div>
    </header>
  );
}
