// app/dev/long-invoice/page.tsx
import type { Metadata } from "next";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { createLongDemoInvoice } from "@/lib/invoice/defaults";
import { calculateInvoiceTotals } from "@/lib/invoice/calculate";
import { paginateInvoiceItems } from "@/lib/invoice/paginate";

export const metadata: Metadata = {
  title: "Pagination harness",
  robots: { index: false, follow: false },
};

/**
 * Development-only pagination harness. It renders the 42-item demo invoice at
 * true A4 size so automated checks can assert page count, A4 proportions and
 * that the totals block lands exactly once on the final page.
 */
export default function LongInvoiceHarnessPage() {
  const invoice = createLongDemoInvoice(42);
  const totals = calculateInvoiceTotals(invoice);
  const { pageCount } = paginateInvoiceItems(invoice, totals);

  return (
    <main
      data-testid="long-invoice-harness"
      className="min-h-screen bg-shell-100 py-10"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}
    >
      <h1 data-testid="harness-title" className="text-sm font-semibold text-shell-700">
        Long invoice — {pageCount} A4 pages
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <InvoiceDocument invoice={invoice} totals={totals} />
      </div>
    </main>
  );
}
