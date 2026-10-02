"use client";

import { memo } from "react";
import { buildInvoiceTokens } from "@/lib/brand/tokens";
import { calculateInvoiceTotals } from "@/lib/invoice/calculate";
import { PAGE } from "@/lib/invoice/layout-metrics";
import { paginateInvoiceItems, type InvoicePageModel } from "@/lib/invoice/paginate";
import type { Invoice, InvoiceTotals } from "@/types/invoice";
import { ContinuationHeader, InvoiceHeader } from "./InvoiceHeader";
import { InvoiceFooterlessSpacer } from "./spacer";
import { InvoicePageFooter, PaymentAndTerms, SignatureBlockView } from "./InvoiceFooter";
import { InvoiceTable } from "./InvoiceTable";
import { InvoiceTotalsBlock } from "./InvoiceTotals";
import { PartiesBlock } from "./PartiesBlock";

interface InvoiceDocumentProps {
  invoice: Invoice;
  /** Pass precomputed totals to avoid recalculating in the preview path. */
  totals?: InvoiceTotals;
  /** Render a single page (used by the paged JPEG exporter). */
  onlyPage?: number;
}

export const InvoiceDocument = memo(function InvoiceDocument({
  invoice,
  totals: providedTotals,
  onlyPage,
}: InvoiceDocumentProps) {
  const totals = providedTotals ?? calculateInvoiceTotals(invoice);
  const { pages, pageCount, metrics } = paginateInvoiceItems(invoice, totals);
  const tokens = buildInvoiceTokens(invoice.brand);

  const visiblePages = onlyPage ? pages.filter((p) => p.pageNumber === onlyPage) : pages;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {visiblePages.map((page) => (
        <InvoicePage
          key={page.pageNumber}
          page={page}
          pageCount={pageCount}
          invoice={invoice}
          totals={totals}
          tokens={tokens}
          metrics={metrics}
        />
      ))}
    </div>
  );
});

function InvoicePage({
  page,
  pageCount,
  invoice,
  totals,
  tokens,
  metrics,
}: {
  page: InvoicePageModel;
  pageCount: number;
  invoice: Invoice;
  totals: InvoiceTotals;
  tokens: ReturnType<typeof buildInvoiceTokens>;
  metrics: ReturnType<typeof paginateInvoiceItems>["metrics"];
}) {
  const rowHeights = page.rows.map((row) => row.height);

  return (
    <article
      data-invoice-page={page.pageNumber}
      aria-label={`Invoice page ${page.pageNumber} of ${pageCount}`}
      style={{
        width: `${PAGE.width}pt`,
        height: `${PAGE.height}pt`,
        padding: `${PAGE.padTop}pt ${PAGE.padX}pt ${PAGE.padBottom}pt`,
        backgroundColor: tokens.pageBg,
        color: tokens.ink,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 12px 32px -12px rgba(0,0,0,0.18)",
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      {/* Optional brand accent rule pinned to the top edge. */}
      {invoice.brand.accentBarEnabled ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3pt",
            backgroundColor: tokens.accent,
          }}
        />
      ) : null}

      {page.isFirst ? (
        <>
          <InvoiceHeader invoice={invoice} tokens={tokens} />
          <PartiesBlock invoice={invoice} tokens={tokens} />
        </>
      ) : (
        <ContinuationHeader invoice={invoice} tokens={tokens} />
      )}

      {page.showTable && page.rows.length > 0 ? (
        <InvoiceTable
          tokens={tokens}
          layout={metrics.table}
          rows={page.rows}
          rowHeights={rowHeights}
          continuedFromPrevious={page.continuedFromPrevious}
          continuesOnNext={page.continuesOnNext}
        />
      ) : null}

      {page.showTail ? (
        <>
          <InvoiceTotalsBlock invoice={invoice} totals={totals} tokens={tokens} />
          <PaymentAndTerms invoice={invoice} tokens={tokens} totals={totals} />
          <SignatureBlockView invoice={invoice} tokens={tokens} />
        </>
      ) : null}

      <InvoiceFooterlessSpacer />
      <InvoicePageFooter
        tokens={tokens}
        pageNumber={page.pageNumber}
        pageCount={pageCount}
        businessName={invoice.business.name || ""}
        socials={invoice.business.socials}
      />
    </article>
  );
}
